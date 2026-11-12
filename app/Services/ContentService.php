<?php

namespace App\Services;

use App\Models\AgentRun;
use App\Models\Client;
use App\Models\ContentItem;
use App\Models\ContentVersion;
use App\Models\Notification;
use App\Models\Approval;
use App\Models\User;
use App\Jobs\RunAgentRequest;

/**
 * Shared helpers for content versions, reviewers, notifications and AI revisions.
 */
class ContentService
{
    public static function createVersion(ContentItem $item, array $fields, string $byType, ?int $byId, ?int $runId): ContentVersion
    {
        return ContentVersion::forceCreate([
            'company_id' => $item->company_id,
            'content_id' => $item->id,
            'version_number' => ((int) ContentVersion::where('content_id', $item->id)->max('version_number')) + 1,
            'language' => $fields['language'],
            'body' => $fields['body'],
            'hashtags' => $fields['hashtags'] ?? [],
            'script' => $fields['script'] ?? null,
            'instruction' => $fields['instruction'] ?? null,
            'created_by_type' => $byType,
            'created_by_id' => $byId,
            'agent_run_id' => $runId,
        ]);
    }

    public static function detectLanguage(string $text): string
    {
        $arabic = preg_match_all('/\p{Arabic}/u', $text);
        $latin = preg_match_all('/[A-Za-z]/', $text);

        return $arabic >= $latin ? 'ar' : 'en';
    }

    /** The AI says "Note to employee: ..." when it lacks information instead of writing content. */
    public static function isNoteToEmployee(string $text): bool
    {
        return stripos(ltrim($text), 'Note to employee') === 0;
    }

    /**
     * Who reviews what the AI wrote for this client: the client's responsible employee,
     * else the active Managers, else the active Owners (staff only, never a client login).
     */
    public static function reviewerIds(int $companyId, ?Client $client): array
    {
        if ($client?->responsible_user_id) {
            $id = User::where('company_id', $companyId)->where('status', 'active')
                ->whereNull('client_id')->whereKey($client->responsible_user_id)->value('id');
            if ($id) {
                return [(int) $id];
            }
        }

        foreach (['Manager', 'Owner'] as $roleName) {
            $ids = User::where('company_id', $companyId)->where('status', 'active')->whereNull('client_id')
                ->whereHas('role', fn ($q) => $q->where('name', $roleName))->pluck('id')->all();
            if ($ids) {
                return array_map('intval', $ids);
            }
        }

        return [];
    }

    public static function notify(int $companyId, array $userIds, string $type, string $title, ?string $body = null, array $data = []): void
    {
        foreach (array_unique($userIds) as $userId) {
            Notification::forceCreate([
                'company_id' => $companyId,
                'user_id' => $userId,
                'type' => $type,
                'title' => $title,
                'body' => $body,
                'data' => $data,
            ]);
        }
    }

    /** Active Managers of the company, else the Owners (internal reviewers). */
    public static function managerIds(int $companyId): array
    {
        foreach (['Manager', 'Owner'] as $roleName) {
            $ids = User::where('company_id', $companyId)->where('status', 'active')->whereNull('client_id')
                ->whereHas('role', fn ($q) => $q->where('name', $roleName))->orderBy('id')->pluck('id')->all();
            if ($ids) {
                return array_map('intval', $ids);
            }
        }

        return [];
    }

    /**
     * Stage 1 (internal): a Manager reviews before the client sees anything.
     * Stored as an approval with reason "escalation" sent to a manager.
     */
    public static function requestInternalReview(ContentItem $item, ?int $byUserId = null): Approval
    {
        $managers = self::managerIds($item->company_id);
        abort_unless($managers, 422, 'No manager found to review this content.');

        $approval = Approval::forceCreate([
            'company_id' => $item->company_id,
            'subject_type' => 'content_item',
            'subject_id' => $item->id,
            'requested_from_type' => 'user',
            'requested_from_id' => $managers[0],
            'requested_by_id' => $byUserId,
            'reason' => 'escalation',
            'status' => 'pending',
        ]);
        $item->forceFill(['status' => 'in_review'])->save();

        self::notify($item->company_id, $managers, 'approval_needed',
            "Manager review needed: {$item->title}", null,
            ['content_id' => $item->id, 'approval_id' => $approval->id, 'stage' => 'internal']);

        return $approval;
    }

    /**
     * Stage 2 (client): by default the request goes to the client's own login (a user linked to the client),
     * else to the client's responsible employee. $approverId overrides.
     */
    public static function requestClientApproval(ContentItem $item, ?int $approverId = null, ?int $byUserId = null): Approval
    {
        $approverId ??= User::where('company_id', $item->company_id)
            ->where('client_id', $item->client_id)->where('status', 'active')->value('id')
            ?? Client::whereKey($item->client_id)->value('responsible_user_id');
        abort_unless($approverId, 422, 'No approver found. Send requested_from_id.');

        $approver = User::where('company_id', $item->company_id)->where('status', 'active')->findOrFail($approverId);

        $approval = Approval::forceCreate([
            'company_id' => $item->company_id,
            'subject_type' => 'content_item',
            'subject_id' => $item->id,
            'requested_from_type' => $approver->client_id ? 'client' : 'user',
            'requested_from_id' => $approver->id,
            'requested_by_id' => $byUserId,
            'reason' => 'policy',
            'status' => 'pending',
        ]);
        $item->forceFill(['status' => 'in_review'])->save();

        self::notify($item->company_id, [$approver->id], 'approval_needed',
            "Please review: {$item->title}", null,
            ['content_id' => $item->id, 'approval_id' => $approval->id, 'stage' => 'client']);

        return $approval;
    }

    /** Ask the AI to rewrite the current version following the employee's notes. Returns the run (202 flow). */
    public static function startRevision(ContentItem $item, string $notes): AgentRun
    {
        $version = $item->currentVersion;
        $language = $version->language === 'ar' ? 'Arabic' : 'English';

        $message = "Revise this {$item->type} for {$item->platform} (title: {$item->title}).\n"
            . "Current text:\n---\n{$version->body}\n---\n"
            . "Notes from the employee who reviewed it:\n{$notes}\n\n"
            . "Apply the notes, keep the client's brand voice, and write in {$language}. "
            . 'Return only the revised text, ready to publish. '
            . 'If a note cannot be applied because information is missing, answer with "Note to employee:" and say what is missing.';

        $run = AgentRun::forceCreate([
            'company_id' => $item->company_id,
            'task_id' => $item->task_id,
            'client_id' => $item->client_id,
            'agent' => 'content',
            'status' => 'running',
            'input' => [
                'mode' => 'revise',
                'content_id' => $item->id,
                'notes' => $notes,
                'message' => $message,
                'language' => $language,
            ],
            'started_at' => now(),
        ]);

        RunAgentRequest::dispatch($run->id);

        return $run;
    }
}
