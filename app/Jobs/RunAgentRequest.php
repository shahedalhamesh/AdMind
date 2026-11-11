<?php

namespace App\Jobs;

use App\Models\AgentRun;
use App\Models\Message;
use App\Services\AiService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Throwable;

/**
 * Runs one agent request in the background (the crew takes minutes) and
 * stores the result in agent_runs. Start the worker with:
 *   php artisan queue:work --timeout=900
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
        $language = $input['language'] ?? 'English';

        if (($input['mode'] ?? 'run') === 'chat') {
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
    }

    public function failed(Throwable $e): void
    {
        AgentRun::whereKey($this->agentRunId)->update([
            'status' => 'failed',
            'error' => mb_substr($e->getMessage(), 0, 1000),
            'finished_at' => now(),
        ]);
    }
}
