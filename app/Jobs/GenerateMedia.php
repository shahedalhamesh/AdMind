<?php

namespace App\Jobs;

use App\Models\ContentItem;
use App\Models\MediaAsset;
use App\Services\AiService;
use App\Services\ContentService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Storage;
use RuntimeException;
use Throwable;

/**
 * Creates an image or a reel with the AI service and stores the file in the media library.
 * Runs on the queue worker: php artisan queue:work --timeout=900
 * metadata.step shows the progress (planning, image, video_voice_music, mixing, saving).
 */
class GenerateMedia implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 1;
    public int $timeout = 900;

    public function __construct(
        public int $mediaId,
        public string $kind,
        public string $language = 'Arabic',
        public ?int $contentId = null,
    ) {
    }

    public function handle(AiService $ai): void
    {
        $media = MediaAsset::withoutGlobalScopes()->findOrFail($this->mediaId);
        $meta = $media->metadata ?? [];

        if ($this->kind === 'image') {
            $res = $ai->generateImage($media->company_id, $media->client_id, (string) $media->prompt, $media->aspect_ratio ?: '1:1');
            $name = $res['file'] ?? null;
            $meta['image_prompt'] = $res['image_prompt'] ?? null;
        } else {
            $job = $ai->startReel($media->company_id, $media->client_id, (string) $media->prompt, $this->language, $media->aspect_ratio ?: '9:16');
            $jobId = $job['job_id'] ?? null;
            if (! $jobId) {
                throw new RuntimeException('The AI service did not start the reel.');
            }

            $deadline = time() + 840;
            $status = [];
            $lastStep = null;
            while (true) {
                sleep(5);
                $status = $ai->reelStatus($media->company_id, $jobId);
                if (($status['step'] ?? null) !== $lastStep) {
                    $lastStep = $status['step'] ?? null;
                    $meta['step'] = $lastStep;
                    $media->forceFill(['metadata' => $meta])->save();
                }
                if (($status['status'] ?? '') === 'done') {
                    break;
                }
                if (($status['status'] ?? '') === 'failed') {
                    throw new RuntimeException('Reel failed: ' . ($status['error'] ?? 'unknown error'));
                }
                if (time() > $deadline) {
                    throw new RuntimeException('The reel took too long.');
                }
            }
            $name = $status['file'] ?? null;
            $meta['plan'] = $status['plan'] ?? null;
            $meta['script'] = $status['script'] ?? null;
            $meta['warnings'] = $status['warnings'] ?? [];
            $meta['image_prompt'] = $status['plan']['image_prompt'] ?? null;
            if (isset($status['plan']['seconds'])) {
                $media->duration_seconds = $status['plan']['seconds'];
            }
        }

        if (! $name) {
            throw new RuntimeException('The AI service returned no file.');
        }

        $meta['step'] = 'saving';
        $bytes = $ai->downloadMedia($name);
        $ext = strtolower(pathinfo($name, PATHINFO_EXTENSION)) ?: ($this->kind === 'image' ? 'png' : 'mp4');
        $path = "media/{$media->company_id}/{$media->client_id}/" . bin2hex(random_bytes(8)) . ".{$ext}";
        Storage::disk('local')->put($path, $bytes);

        $meta['step'] = 'done';
        $media->forceFill(['path' => $path, 'status' => 'ready', 'error' => null, 'metadata' => $meta])->save();

        if ($this->contentId && ($item = ContentItem::withoutGlobalScopes()->where('client_id', $media->client_id)->find($this->contentId))) {
            $item->mediaAssets()->syncWithoutDetaching([$media->id => ['position' => $item->mediaAssets()->count()]]);
        }

        if (! empty($meta['requested_by'])) {
            ContentService::notify($media->company_id, [(int) $meta['requested_by']], 'media_ready',
                $this->kind === 'image' ? 'Your AI image is ready' : 'Your AI reel is ready', null,
                ['media_id' => $media->id, 'content_id' => $this->contentId]);
        }
    }

    public function failed(Throwable $e): void
    {
        $media = MediaAsset::withoutGlobalScopes()->find($this->mediaId);
        if (! $media) {
            return;
        }
        $meta = $media->metadata ?? [];
        $media->forceFill(['status' => 'failed', 'error' => mb_substr($e->getMessage(), 0, 500)])->save();

        $to = array_filter([(int) ($meta['requested_by'] ?? 0)]) ?: ContentService::managerIds($media->company_id);
        ContentService::notify($media->company_id, $to, 'failure',
            $this->kind === 'image' ? 'The AI could not create the image' : 'The AI could not create the reel',
            mb_substr($e->getMessage(), 0, 300), ['media_id' => $media->id]);
    }
}
