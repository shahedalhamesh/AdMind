<?php

namespace App\Jobs;

use App\Models\AgentRun;
use App\Models\Client;
use App\Models\ContentItem;
use App\Models\Message;
use App\Models\Task;
use App\Services\AiService;
use App\Services\ContentService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\DB;
use Throwable;

/**
 * Runs one agent request in the background (the crew takes minutes) and
 * stores the result in agent_runs. Start the worker with:
 *   php artisan queue:work --timeout=900
 *
 * Modes: chat, run (free requests), task (AI does a task and creates a content draft),
 * revise (AI rewrites a content item following the employee's notes).
 */
class RunAgentRequest implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    // Never run twice by itself: each run costs model quota.
    public int $tries = 1;
    public int $timeout = 900;

    public function __construct(public int $agentRunId)
    {
    }

    public function handle(AiService $ai): void
    {
        $run = AgentRun::findOrFail($this->agentRunId);
        $input = $run->input;
        $mode = $input['mode'] ?? 'run';
        $language = $input['language'] ?? 'English';

        if ($mode === 'chat') {
            $conversationId = $run->conversation_id ? (string) $run->conversation_id : null;
            $result = $ai->chat($run->company_id, $run->client_id, $input['message'], $conversationId, $language);
        } else {
            $result = $ai->run($run->company_id, $run->client_id, $input['message'], $language);
        }

        $verification = $result['verification'] ?? null;
        if (! in_array($verification, ['ok', 'corrected', 'skipped', 'failed'], true)) {
            $verification = null;
        }

        $run->forceFill([
            'status' => 'succeeded',
            'output' => $result['result'] ?? '',
            'episode_id' => $result['episode_id'] ?? null,
            'verification_status' => $verification,
            'original_output' => $result['original'] ?? null,
            'finished_at' => now(),
        ])->save();

        if ($run->conversation_id) {
            Message::forceCreate([
                'company_id' => $run->company_id,
                'conversation_id' => $run->conversation_id,
                'sender_type' => 'agent',
                'sender_agent' => $run->agent,
                'content' => $result['result'] ?? '',
                'meta' => [
                    'agent_run_id' => $run->id,
                    'episode_id' => $result['episode_id'] ?? null,
                    'verification' => $verification,
                ],
            ]);
        }

        if ($mode === 'task') {
            $this->afterTask($run);
        } elseif ($mode === 'revise') {
            $this->afterRevision($run);
        }
    }

    /** The AI finished a task: create the content draft and tell the reviewer. */
    private function afterTask(AgentRun $run): void
    {
        $task = Task::findOrFail($run->task_id);
        $client = Client::find($run->client_id);
        $reviewers = ContentService::reviewerIds($run->company_id, $client);
        $text = trim((string) $run->output);

        if (ContentService::isNoteToEmployee($text)) {
            $task->forceFill(['status' => 'waiting_info'])->save();
            ContentService::notify($run->company_id, $reviewers, 'info_needed',
                "The AI needs more information: {$task->title}", $text,
                ['task_id' => $task->id, 'agent_run_id' => $run->id]);

            return;
        }

        $input = $run->input;

        $item = DB::transaction(function () use ($run, $task, $text, $input) {
            $item = ContentItem::forceCreate([
                'company_id' => $run->company_id,
                'client_id' => $run->client_id,
                'task_id' => $task->id,
                'type' => $input['content_type'] ?? 'post',
                'platform' => $input['platform'] ?? 'instagram',
                'title' => $task->title,
                'status' => 'draft',
                'created_by_type' => 'agent',
                'created_by_id' => null,
                'source_run_id' => $run->id,
                'is_example' => false,
            ]);
            $version = ContentService::createVersion($item, [
                'body' => $text,
                'language' => ContentService::detectLanguage($text),
            ], 'agent', null, $run->id);
            $item->forceFill(['current_version_id' => $version->id])->save();
            $task->forceFill(['status' => 'waiting_approval'])->save();

            return $item;
        });

        // so the frontend can find the draft from the run it is polling
        $run->forceFill(['input' => $input + ['content_id' => $item->id]])->save();

        ContentService::notify($run->company_id, $reviewers, 'approval_needed',
            "Ready for your review: {$task->title}", null,
            ['task_id' => $task->id, 'content_id' => $item->id, 'agent_run_id' => $run->id]);
    }

    /** The AI rewrote a content item following the employee's notes: new version, back to draft. */
    private function afterRevision(AgentRun $run): void
    {
        $item = ContentItem::findOrFail($run->input['content_id']);
        $client = Client::find($run->client_id);
        $reviewers = ContentService::reviewerIds($run->company_id, $client);
        $text = trim((string) $run->output);

        if (ContentService::isNoteToEmployee($text)) {
            ContentService::notify($run->company_id, $reviewers, 'info_needed',
                "The AI needs more information: {$item->title}", $text,
                ['content_id' => $item->id, 'agent_run_id' => $run->id]);

            return;
        }

        DB::transaction(function () use ($run, $item, $text) {
            $version = ContentService::createVersion($item, [
                'body' => $text,
                'language' => ContentService::detectLanguage($text),
                'instruction' => $run->input['notes'] ?? null,
            ], 'agent', null, $run->id);
            $item->forceFill(['current_version_id' => $version->id, 'status' => 'draft'])->save();

            if ($item->task_id) {
                Task::whereKey($item->task_id)->update(['status' => 'waiting_approval']);
            }
        });

        ContentService::notify($run->company_id, $reviewers, 'approval_needed',
            "Revised version ready: {$item->title}", null,
            ['task_id' => $item->task_id, 'content_id' => $item->id, 'agent_run_id' => $run->id]);
    }

    public function failed(Throwable $e): void
    {
        AgentRun::whereKey($this->agentRunId)->update([
            'status' => 'failed',
            'error' => mb_substr($e->getMessage(), 0, 1000),
            'finished_at' => now(),
        ]);

        $run = AgentRun::find($this->agentRunId);
        $mode = $run?->input['mode'] ?? null;
        if (! in_array($mode, ['task', 'revise'], true)) {
            return;
        }

        if ($mode === 'task' && $run->task_id) {
            Task::whereKey($run->task_id)->update(['status' => 'failed']);
        }

        $title = $mode === 'task'
            ? (Task::whereKey($run->task_id)->value('title') ?? 'task')
            : (ContentItem::whereKey($run->input['content_id'] ?? 0)->value('title') ?? 'content');

        ContentService::notify($run->company_id,
            ContentService::reviewerIds($run->company_id, Client::find($run->client_id)),
            'failure', "The AI could not finish: {$title}", mb_substr($e->getMessage(), 0, 300),
            ['task_id' => $run->task_id, 'agent_run_id' => $run->id]);
    }
}
