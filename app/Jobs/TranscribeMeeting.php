<?php

namespace App\Jobs;

use App\Models\Meeting;
use App\Services\AiService;
use App\Services\ContentService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Storage;
use Throwable;

/**
 * Turns a meeting recording into a transcript (speech to text on the AI service).
 * Runs on the same queue worker: php artisan queue:work --timeout=900
 */
class TranscribeMeeting implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 1;
    public int $timeout = 900;

    public function __construct(public int $meetingId, public ?string $language = null)
    {
    }

    public function handle(AiService $ai): void
    {
        $meeting = Meeting::findOrFail($this->meetingId);
        abort_if(blank($meeting->recording_path), 422, 'No recording.');

        $result = $ai->transcribe(Storage::disk('local')->path($meeting->recording_path), $this->language);
        $text = trim((string) ($result['text'] ?? ''));
        if ($text === '') {
            throw new \RuntimeException('No speech was found in the recording.');
        }

        // keep within the transcript limit used by the meeting endpoints
        $meeting->forceFill(['transcript' => mb_substr($text, 0, 50000), 'status' => 'uploaded'])->save();
    }

    public function failed(Throwable $e): void
    {
        $meeting = Meeting::find($this->meetingId);
        if (! $meeting) {
            return;
        }
        $meeting->forceFill(['status' => 'failed'])->save();
        ContentService::notify($meeting->company_id, ContentService::managerIds($meeting->company_id), 'failure',
            "Could not transcribe the recording: {$meeting->title}", mb_substr($e->getMessage(), 0, 300),
            ['meeting_id' => $meeting->id]);
    }
}
