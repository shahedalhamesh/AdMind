<?php

namespace App\Services;

use App\Models\AgentRun;
use App\Models\Client;
use App\Models\ContentItem;
use App\Models\ContentVersion;
use App\Models\Notification;
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
