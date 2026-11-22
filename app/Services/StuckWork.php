<?php

namespace App\Services;

use App\Jobs\GenerateMedia;
use App\Jobs\RunAgentRequest;
use App\Models\AgentRun;
use App\Models\MediaAsset;
use Illuminate\Support\Facades\Cache;
use RuntimeException;

/**
 * Work that was left "running" / "processing" because the worker died or was cut off (for example a
 * sync queue stopped by the 60 second PHP limit). After a time limit it is marked failed, so it no longer
 * blocks new requests ("The AI is already working on this...").
 *
 * - agent runs: 10 minutes (the job itself is allowed 15, a late result still overwrites the failure)
 * - AI media (images, reels): 16 minutes (a reel can legitimately take up to 14)
 *
 * Inside a request it only touches the company of the logged-in user (the company scope);
 * from the command line it touches everything.
 */
class StuckWork
{
    public const RUN_MINUTES = 10;
    public const MEDIA_MINUTES = 16;

    /** Cheap to call on every poll: runs at most once every 30 seconds per company. */
    public static function sweepThrottled(): void
    {
        $key = 'stuck-work-sweep:' . (auth()->user()?->company_id ?? 'all');
        if (Cache::add($key, 1, 30)) {
            self::sweep();
        }
    }

    /** @return array{runs:int, media:int} */
    public static function sweep(int $runMinutes = self::RUN_MINUTES, int $mediaMinutes = self::MEDIA_MINUTES): array
    {
        $runs = 0;
        $media = 0;

        AgentRun::where('status', 'running')
            ->where('started_at', '<', now()->subMinutes($runMinutes))
            ->get()
            ->each(function (AgentRun $run) use (&$runs, $runMinutes) {
                // same clean-up as a failed job: run, task, meeting and notification
                (new RunAgentRequest($run->id))->failed(
                    new RuntimeException("Timed out: no result after {$runMinutes} minutes.")
                );
                $runs++;
            });

        MediaAsset::where('status', 'processing')
            ->where('updated_at', '<', now()->subMinutes($mediaMinutes))
            ->get()
            ->each(function (MediaAsset $m) use (&$media, $mediaMinutes) {
                $kind = $m->metadata['kind'] ?? ($m->type === 'video' ? 'reel' : 'image');
                (new GenerateMedia($m->id, $kind))->failed(
                    new RuntimeException("Timed out: no result after {$mediaMinutes} minutes.")
                );
                $media++;
            });

        return ['runs' => $runs, 'media' => $media];
    }
}
