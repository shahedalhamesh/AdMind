<?php

namespace App\Services;

use App\Jobs\PublishPost;
use App\Models\AiPolicy;
use App\Models\Client;
use App\Models\ContentItem;
use App\Models\PublishJob;
use App\Models\SocialAccount;
use App\Services\Publishing\PublishManager;
use Illuminate\Support\Facades\DB;

/** Reads the AI policy of a client and applies it (see AiPolicyController for the meaning of the levels). */
class AiPolicyService
{
    private const BUILT_IN = ['autonomy_level' => 'assisted', 'max_spend' => null, 'approval_rules' => [], 'publish_rules' => [], 'escalate_to_user_id' => null];

    /** The client's own policy, else the company default, else the built-in one. */
    public static function effective(int $companyId, ?int $clientId): array
    {
        $own = $clientId ? AiPolicy::withoutGlobalScopes()->where('company_id', $companyId)->where('client_id', $clientId)->first() : null;
        $default = AiPolicy::withoutGlobalScopes()->where('company_id', $companyId)->whereNull('client_id')->first();

        return ($own ?? $default)?->toArray() ?? self::BUILT_IN;
    }

    /** manual = the AI is turned off for this client. */
    public static function aiAllowed(int $companyId, ?int $clientId): bool
    {
        return self::effective($companyId, $clientId)['autonomy_level'] !== 'manual';
    }

    /**
     * After the client's final approval: with an autonomous policy and publish_rules.auto_publish = true,
     * schedule the post by itself (at its own scheduled_at if that is in the future, else in 2 minutes).
     * Needs automatic publishing to be on (PUBLISH_PROVIDER=simulation or meta). Returns the publish job or null.
     */
    public static function autoSchedule(ContentItem $item): ?PublishJob
    {
        $item = $item->fresh();
        if (! $item || $item->status !== 'approved' || ! $item->current_version_id || ! PublishManager::automatic()) {
            return null;
        }

        $policy = self::effective($item->company_id, $item->client_id);
        $rules = $policy['publish_rules'] ?? [];
        if ($policy['autonomy_level'] !== 'autonomous' || empty($rules['auto_publish'])) {
            return null;
        }
        $allowed = $rules['allowed_platforms'] ?? [];
        if ($allowed && ! in_array($item->platform, $allowed, true)) {
            return null;
        }

        $managers = ContentService::managerIds($item->company_id);
        $account = SocialAccount::withoutGlobalScopes()->where('client_id', $item->client_id)->where('platform', $item->platform)->orderBy('id')->first();
        if (! $account) {
            $client = Client::withoutGlobalScopes()->find($item->client_id);
            ContentService::notify($item->company_id, $managers, 'info_needed', "Auto-publish skipped: {$item->title}",
                'The client has no '.$item->platform.' account'.($client ? " ({$client->name})" : '').'. Add one and schedule the post by hand.',
                ['content_id' => $item->id]);

            return null;
        }

        $at = ($item->scheduled_at && $item->scheduled_at->isFuture()) ? $item->scheduled_at : now()->addMinutes(2);
        $job = DB::transaction(function () use ($item, $account, $at) {
            $job = PublishJob::forceCreate([
                'company_id' => $item->company_id, 'content_id' => $item->id, 'content_version_id' => $item->current_version_id,
                'social_account_id' => $account->id, 'scheduled_at' => $at, 'status' => 'pending',
            ]);
            $item->forceFill(['status' => 'scheduled', 'scheduled_at' => $at])->save();

            return $job;
        });
        PublishPost::dispatch($job->id)->delay($at);

        ContentService::notify($item->company_id, $managers, 'auto_scheduled', "Auto-scheduled: {$item->title}",
            'The AI policy allows automatic publishing. It goes out at '.$at->format('Y-m-d H:i').' UTC.',
            ['content_id' => $item->id, 'publish_job_id' => $job->id]);

        return $job;
    }
}
