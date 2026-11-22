<?php

namespace App\Services\Publishing;

use App\Models\PublishJob;
use App\Models\MediaAsset;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use RuntimeException;
use Symfony\Component\Process\Process;

/**
 * Real posting to Instagram through the Instagram API (content publishing):
 *   1. create a media container (image / reel / story / carousel) from a public URL,
 *   2. wait until Instagram has processed it (video only),
 *   3. publish the container.
 * Facebook Pages are not connected yet, so a Facebook job fails with a clear message.
 */
class MetaProvider implements PublishProvider
{
    public function publish(PublishJob $job): array
    {
        $cfg = config('publishing.meta');
        foreach (['ig_user_id' => 'META_IG_USER_ID', 'access_token' => 'META_IG_ACCESS_TOKEN', 'public_base_url' => 'META_PUBLIC_BASE_URL'] as $key => $env) {
            if (empty($cfg[$key])) {
                throw new RuntimeException("Meta is not configured: {$env} is missing in .env.");
            }
        }

        $content = $job->content()->withoutGlobalScopes()->firstOrFail();
        if ($content->platform !== 'instagram') {
            throw new RuntimeException("Real posting is only set up for Instagram (this post is for {$content->platform}).");
        }

        $version = $job->contentVersion()->withoutGlobalScopes()->first();
        $caption = $this->caption($version?->body, $version?->hashtags);

        $media = $content->mediaAssets()->withoutGlobalScopes()->where('media_assets.status', 'ready')
            ->whereIn('media_assets.type', ['image', 'video'])->get()
            ->filter(fn ($m) => $m->path);
        if ($media->isEmpty()) {
            throw new RuntimeException('This post has no image or video. Instagram needs media to publish.');
        }

        $containerId = $this->createContainer($content->type, $media, $caption, $cfg);

        $res = $this->call('post', "{$cfg['ig_user_id']}/media_publish", ['creation_id' => $containerId], $cfg);

        return ['external_post_id' => (string) $res['id']];
    }

    private function createContainer(string $type, $media, string $caption, array $cfg): string
    {
        $first = $media->first();
        $isVideo = $first->type === 'video';
        $videoFile = $isVideo ? $this->prepareVideo($first, $cfg) : null;

        // Several images: a carousel.
        if ($media->count() > 1 && $media->every(fn ($m) => $m->type === 'image') && $type === 'post') {
            $children = [];
            foreach ($media->take(10) as $m) {
                $r = $this->call('post', "{$cfg['ig_user_id']}/media", [
                    'image_url' => $this->url($m->id, 'jpg', $cfg), 'is_carousel_item' => 'true',
                ], $cfg);
                $children[] = $r['id'];
            }
            $r = $this->call('post', "{$cfg['ig_user_id']}/media", [
                'media_type' => 'CAROUSEL', 'children' => implode(',', $children), 'caption' => $caption,
            ], $cfg);

            return $r['id'];
        }

        // A video is pushed straight to Instagram (resumable upload), so Instagram never has to download it
        // from our tunnel. If the account cannot use resumable uploads, fall back to the public link below.
        if ($isVideo) {
            try {
                $id = $this->uploadVideo($videoFile, $type === 'story' ? 'STORIES' : 'REELS', $caption, $cfg);
                $this->waitUntilReady($id, $cfg);

                return $id;
            } catch (RuntimeException $e) {
                if (! str_starts_with($e->getMessage(), 'Resumable upload unavailable')) {
                    throw $e;
                }
            }
        }

        $params = [];
        if ($type === 'story') {
            $params['media_type'] = 'STORIES';
            $params[$isVideo ? 'video_url' : 'image_url'] = $this->url($first->id, $isVideo ? 'mp4' : 'jpg', $cfg);
        } elseif ($isVideo) {
            // Instagram no longer accepts plain "VIDEO"; every feed video is published as a reel.
            $params = ['media_type' => 'REELS', 'video_url' => $this->url($first->id, 'mp4', $cfg), 'caption' => $caption];
        } else {
            $params = ['image_url' => $this->url($first->id, 'jpg', $cfg), 'caption' => $caption];
        }
        if ($type !== 'story') {
            $params['caption'] = $caption;
        }

        $r = $this->call('post', "{$cfg['ig_user_id']}/media", $params, $cfg);
        $id = $r['id'];

        if ($isVideo) {
            $this->waitUntilReady($id, $cfg);
        }

        return $id;
    }

    /**
     * Instagram only accepts 23-60 FPS video, but the AI service makes 16 FPS clips (and small ones).
     * Convert once to 720x1280, 30 FPS, H.264 + AAC with ffmpeg and keep the result in storage/app/ig-ready.
     * The public link then serves this converted copy.
     */
    private function prepareVideo(MediaAsset $media, array $cfg): string
    {
        $disk = Storage::disk('local');
        $out = "ig-ready/{$media->id}.mp4";
        if ($disk->exists($out)) {
            return $disk->path($out);
        }
        $disk->makeDirectory('ig-ready');

        $process = new Process([
            $cfg['ffmpeg'] ?: 'ffmpeg', '-y', '-v', 'error', '-i', $disk->path($media->path),
            '-map', '0:v:0', '-map', '0:a?',
            '-vf', 'scale=720:1280:force_original_aspect_ratio=increase:flags=lanczos,crop=720:1280,fps=30,format=yuv420p',
            '-c:v', 'libx264', '-profile:v', 'high', '-preset', 'veryfast', '-crf', '20', '-x264-params', 'open-gop=0', '-r', '30',
            '-c:a', 'aac', '-b:a', '128k', '-ar', '48000', '-ac', '2',
            '-movflags', '+faststart', $disk->path($out),
        ]);
        $process->setTimeout(100);
        $process->run();

        if (! $process->isSuccessful() || ! $disk->exists($out)) {
            $disk->delete($out);
            throw new RuntimeException('Could not convert the video for Instagram (is ffmpeg installed?): '
                .mb_substr(trim($process->getErrorOutput() ?: $process->getOutput()), -300));
        }

        return $disk->path($out);
    }

    /** Create a resumable container and send the video file to rupload.facebook.com. Returns the container id. */
    private function uploadVideo(string $file, string $mediaType, string $caption, array $cfg): string
    {
        $params = ['media_type' => $mediaType, 'upload_type' => 'resumable'];
        if ($mediaType !== 'STORIES') {
            $params['caption'] = $caption;
        }
        try {
            $container = $this->call('post', "{$cfg['ig_user_id']}/media", $params, $cfg);
        } catch (RuntimeException $e) {
            throw new RuntimeException('Resumable upload unavailable: '.$e->getMessage());
        }
        $id = (string) $container['id'];

        $response = Http::withHeaders([
            'Authorization' => 'OAuth '.$cfg['access_token'],
            'offset' => '0',
            'file_size' => (string) filesize($file),
        ])->withBody((string) file_get_contents($file), 'application/octet-stream')
            ->timeout(120)
            ->post("https://rupload.facebook.com/ig-api-upload/{$cfg['graph_version']}/{$id}");

        if ($response->failed() || ! $response->json('success')) {
            $msg = $response->json('debug_info.message') ?? $response->json('error.message') ?? $response->body();
            throw new RuntimeException('Instagram video upload failed: '
                .str_replace((string) $cfg['access_token'], '***', mb_substr((string) $msg, 0, 300)));
        }

        return $id;
    }

    private function waitUntilReady(string $containerId, array $cfg): void
    {
        $deadline = time() + (int) $cfg['video_wait_seconds'];
        do {
            sleep(5);
            $s = $this->call('get', $containerId, ['fields' => 'status_code,status'], $cfg);
            $code = $s['status_code'] ?? '';
            if ($code === 'FINISHED') {
                return;
            }
            if (in_array($code, ['ERROR', 'EXPIRED'], true)) {
                throw new RuntimeException('Instagram could not process the video: '.($s['status'] ?? $code));
            }
        } while (time() < $deadline);

        throw new RuntimeException('Instagram took too long to process the video.');
    }

    private function caption(?string $body, $hashtags): string
    {
        if (is_string($hashtags)) {
            $hashtags = json_decode($hashtags, true) ?: [];
        }
        $tags = collect(is_array($hashtags) ? $hashtags : [])
            ->map(fn ($t) => '#'.ltrim(trim((string) $t), '#'))->filter(fn ($t) => $t !== '#')->implode(' ');

        return mb_substr(trim(trim((string) $body)."\n\n".$tags), 0, 2200);
    }

    /** A temporary public link for one media file (HMAC-signed, no login needed). */
    private function url(int $mediaId, string $ext, array $cfg): string
    {
        $exp = time() + 60 * (int) $cfg['media_link_minutes'];
        $sig = self::sign($mediaId, $exp);

        return rtrim($cfg['public_base_url'], '/')."/api/public-media/{$mediaId}/{$exp}/{$sig}/file.{$ext}";
    }

    public static function sign(int $mediaId, int $exp): string
    {
        return hash_hmac('sha256', "media|{$mediaId}|{$exp}", (string) config('app.key'));
    }

    private function call(string $method, string $path, array $params, array $cfg): array
    {
        $url = rtrim($cfg['graph_host'], '/')."/{$cfg['graph_version']}/".ltrim($path, '/');
        $params['access_token'] = $cfg['access_token'];

        $response = $method === 'get'
            ? Http::timeout(60)->get($url, $params)
            : Http::timeout(60)->asForm()->post($url, $params);

        if ($response->failed()) {
            $msg = $response->json('error.message') ?? $response->body();
            // Never leak the token into logs or the failure notification.
            throw new RuntimeException('Instagram: '.str_replace((string) $cfg['access_token'], '***', mb_substr((string) $msg, 0, 400)));
        }

        return $response->json() ?? [];
    }
}
