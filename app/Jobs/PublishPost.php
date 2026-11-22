<?php

namespace App\Jobs;

use App\Models\ContentItem;
use App\Models\PublishJob;
use App\Services\ContentService;
use App\Services\Publishing\PublishManager;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\DB;
use Throwable;

/**
 * Publishes one scheduled post. It is queued with a delay until scheduled_at, so the normal queue worker
 * (php artisan queue:work) is all that is needed. Safe to run twice: only a pending job is claimed.
 * $force = true skips the time check ("publish now").
 */
class PublishPost implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 1;
    public int $timeout = 120;

    public function __construct(public int $publishJobId, public bool $force = false)
    {
    }

    public function handle(PublishManager $manager): void
    {
        $claim = PublishJob::withoutGlobalScopes()->whereKey($this->publishJobId)->where('status', 'pending');
        if (! $this->force) {
            // A reschedule queues a new job; an old one that wakes up too early does nothing.
            $claim->where('scheduled_at', '<=', now()->addSeconds(5));
        }
        if (! $claim->update(['status' => 'publishing'])) {
            return;
        }

        $job = PublishJob::withoutGlobalScopes()->with('content')->findOrFail($this->publishJobId);
        $content = $job->content;

        try {
            $result = $manager->provider()->publish($job);

            DB::transaction(function () use ($job, $result) {
                $job->forceFill([
                    'status' => 'published', 'published_at' => now(), 'last_error' => null,
                    'external_post_id' => $result['external_post_id'] ?? null, 'attempts' => $job->attempts + 1,
                ])->save();
                ContentItem::withoutGlobalScopes()->whereKey($job->content_id)->update(['status' => 'published', 'published_at' => now()]);
            });

            ContentService::notify($job->company_id, ContentService::managerIds($job->company_id), 'post_published',
                'Post published: '.($content->title ?? "#{$job->content_id}"), PublishManager::name() === 'simulation' ? 'Simulation: nothing was sent to the platform.' : null,
                ['content_id' => $job->content_id, 'publish_job_id' => $job->id]);
        } catch (Throwable $e) {
            $job->forceFill(['status' => 'failed', 'last_error' => mb_substr($e->getMessage(), 0, 1000), 'attempts' => $job->attempts + 1])->save();
            ContentItem::withoutGlobalScopes()->whereKey($job->content_id)->update(['status' => 'failed']);

            ContentService::notify($job->company_id, ContentService::managerIds($job->company_id), 'failure',
                'Publishing failed: '.($content->title ?? "#{$job->content_id}"), mb_substr($e->getMessage(), 0, 300),
                ['content_id' => $job->content_id, 'publish_job_id' => $job->id]);
        }
    }
}
