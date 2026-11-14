<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ContentItem;
use App\Models\PublishJob;
use App\Models\SocialAccount;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Scheduling and publishing of approved content.
 *
 *   approved --schedule--> scheduled --mark-published--> published
 *                              |--cancel--> approved
 *
 * Posting itself is manual for now: at the scheduled time the team posts the content and then calls
 * mark-published. A job that is still "pending" after its time is overdue (the UI should highlight it).
 * Automatic posting through the platforms' APIs can replace the manual step later.
 */
class PublishController extends Controller
{
    /** Filters: status (one or comma separated), client_id, from, to (dates on scheduled_at), overdue=1. */
    public function index(Request $request): JsonResponse
    {
        $query = $this->visible($request)
            ->with(['content:id,client_id,title,type,platform,status', 'socialAccount:id,platform,account_name'])
            ->orderBy('scheduled_at');

        if ($request->filled('status')) {
            $query->whereIn('status', explode(',', $request->query('status')));
        }
        if ($request->filled('client_id')) {
            $query->whereHas('content', fn ($q) => $q->where('client_id', $request->query('client_id')));
        }
        if ($request->filled('from')) {
            $query->where('scheduled_at', '>=', $request->query('from'));
        }
        if ($request->filled('to')) {
            $query->where('scheduled_at', '<=', $request->query('to'));
        }
        if ($request->boolean('overdue')) {
            $query->where('status', 'pending')->where('scheduled_at', '<', now());
        }

        return response()->json($query->paginate(min((int) $request->query('per_page', 50), 100)));
    }

    /**
     * Schedule approved content. Body: scheduled_at (future), social_account_id (optional: by default the client's
     * account on the content's platform).
     */
    public function schedule(Request $request, int $id): JsonResponse
    {
        $item = ContentItem::findOrFail($id);
        abort_unless($item->status === 'approved' && $item->current_version_id, 422, 'Only approved content can be scheduled.');

        $data = $request->validate([
            'scheduled_at' => ['required', 'date', 'after:now'],
            'social_account_id' => ['nullable', 'integer'],
        ]);

        $accounts = SocialAccount::where('client_id', $item->client_id)->where('platform', $item->platform);
        $account = ! empty($data['social_account_id'])
            ? $accounts->findOrFail($data['social_account_id'])
            : $accounts->orderBy('id')->first();
        abort_unless($account, 422, "The client has no {$item->platform} account. Add one first.");

        $job = DB::transaction(function () use ($item, $account, $data) {
            $job = PublishJob::forceCreate([
                'company_id' => $item->company_id,
                'content_id' => $item->id,
                'content_version_id' => $item->current_version_id,
                'social_account_id' => $account->id,
                'scheduled_at' => $data['scheduled_at'],
                'status' => 'pending',
            ]);
            $item->forceFill(['status' => 'scheduled', 'scheduled_at' => $data['scheduled_at']])->save();

            return $job;
        });

        return response()->json($job->load('socialAccount:id,platform,account_name'), 201);
    }

    /** Change the time of a pending job. */
    public function reschedule(Request $request, int $id): JsonResponse
    {
        $job = $this->visible($request)->findOrFail($id);
        abort_unless($job->status === 'pending', 422, 'Only a pending post can be rescheduled.');

        $data = $request->validate(['scheduled_at' => ['required', 'date', 'after:now']]);

        DB::transaction(function () use ($job, $data) {
            $job->forceFill(['scheduled_at' => $data['scheduled_at']])->save();
            ContentItem::whereKey($job->content_id)->update(['scheduled_at' => $data['scheduled_at']]);
        });

        return response()->json($job->fresh());
    }

    /** Cancel a pending job: the content goes back to approved. */
    public function cancel(Request $request, int $id): JsonResponse
    {
        $job = $this->visible($request)->findOrFail($id);
        abort_unless($job->status === 'pending', 422, 'Only a pending post can be cancelled.');

        DB::transaction(function () use ($job) {
            $job->forceFill(['status' => 'cancelled'])->save();
            ContentItem::whereKey($job->content_id)->update(['status' => 'approved', 'scheduled_at' => null]);
        });

        return response()->json($job->fresh());
    }

    /** The team posted it: record it. Body (optional): external_post_id (the post's id or link on the platform). */
    public function markPublished(Request $request, int $id): JsonResponse
    {
        $job = $this->visible($request)->findOrFail($id);
        abort_unless($job->status === 'pending', 422, 'Only a pending post can be marked as published.');

        $data = $request->validate(['external_post_id' => ['nullable', 'string', 'max:255']]);

        DB::transaction(function () use ($job, $data) {
            $job->forceFill([
                'status' => 'published',
                'published_at' => now(),
                'external_post_id' => $data['external_post_id'] ?? null,
                'attempts' => $job->attempts + 1,
            ])->save();
            ContentItem::whereKey($job->content_id)->update(['status' => 'published', 'published_at' => now()]);
        });

        return response()->json($job->fresh());
    }

    /** A client's own login only sees the posts of its client. */
    private function visible(Request $request): Builder
    {
        $query = PublishJob::query();
        $user = $request->user();

        if ($user->client_id) {
            $query->whereHas('content', fn ($q) => $q->where('client_id', $user->client_id));
        }

        return $query;
    }
}
