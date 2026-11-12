<?php

namespace App\Jobs;

use App\Services\AiService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

/**
 * Tells the AI service how a client judged something it wrote, so it learns the client's
 * taste. Runs in the background: a slow or stopped AI service never blocks an approval.
 */
class SendAiFeedback implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;
    public int $timeout = 120;

    public function __construct(
        public int $companyId,
        public int $episodeId,
        public string $status,   // approved | rejected
        public string $feedback,
    ) {
    }

    /** Seconds to wait before retry 2 and 3 (for example while the AI service is restarting). */
    public function backoff(): array
    {
        return [10, 60];
    }

    public function handle(AiService $ai): void
    {
        $ai->sendFeedback($this->companyId, $this->episodeId, $this->status, $this->feedback);
    }
}
