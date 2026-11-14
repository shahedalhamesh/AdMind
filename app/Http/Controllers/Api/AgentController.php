<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Jobs\RunAgentRequest;
use App\Models\AgentRun;
use App\Models\Client;
use App\Models\Conversation;
use App\Models\Message;
use App\Services\ContentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class AgentController extends Controller
{
    /** Conversation turn with the Main Agent. Returns at once; poll GET /agent/runs/{id}. */
    public function chat(Request $request): JsonResponse
    {
        $data = $request->validate([
            'client_id' => ['required', 'integer'],
            'message' => ['required', 'string', 'max:4000'],
            'conversation_id' => ['nullable', 'integer'],
            'language' => ['nullable', 'string', 'max:30'],
        ]);

        $user = $request->user();
        abort_if($user->company_id === null, 403, 'A platform admin cannot run agents.');

        // The company scope makes this 404 for a client of another company
        $client = Client::findOrFail($data['client_id']);

        if (! empty($data['conversation_id'])) {
            $conversation = Conversation::where('user_id', $user->id)
                ->where('client_id', $client->id)
                ->findOrFail($data['conversation_id']);
        } else {
            $conversation = Conversation::forceCreate([
                'company_id' => $user->company_id,
                'scope' => 'main_agent',
                'user_id' => $user->id,
                'client_id' => $client->id,
                'agent' => 'main',
                'title' => Str::limit($data['message'], 60),
            ]);
        }

        Message::forceCreate([
            'company_id' => $user->company_id,
            'conversation_id' => $conversation->id,
            'sender_type' => 'user',
            'sender_id' => $user->id,
            'content' => $data['message'],
        ]);

        $run = $this->startRun($user->company_id, $client->id, 'chat', $data, $conversation->id);

        return response()->json([
            'agent_run_id' => $run->id,
            'conversation_id' => $conversation->id,
            'status' => 'running',
        ], 202);
    }

    /** One-shot request, no conversation history. */
    public function run(Request $request): JsonResponse
    {
        $data = $request->validate([
            'client_id' => ['required', 'integer'],
            'message' => ['required', 'string', 'max:4000'],
            'language' => ['nullable', 'string', 'max:30'],
        ]);

        $user = $request->user();
        abort_if($user->company_id === null, 403, 'A platform admin cannot run agents.');

        $client = Client::findOrFail($data['client_id']);
        $run = $this->startRun($user->company_id, $client->id, 'run', $data, null);

        return response()->json(['agent_run_id' => $run->id, 'status' => 'running'], 202);
    }

    public function show(int $id): JsonResponse
    {
        $run = AgentRun::findOrFail($id);

        return response()->json([
            'id' => $run->id,
            'status' => $run->status,
            'mode' => $run->input['mode'] ?? null,
            'task_id' => $run->task_id,
            'content_id' => $run->input['content_id'] ?? null,
            'needs_info' => ContentService::isNoteToEmployee((string) $run->output),
            'conversation_id' => $run->conversation_id,
            'output' => $run->output,
            'verification_status' => $run->verification_status,
            'original_output' => $run->original_output,
            'error' => $run->error,
            'started_at' => $run->started_at,
            'finished_at' => $run->finished_at,
        ]);
    }

    public function messages(Request $request, int $id): JsonResponse
    {
        $conversation = Conversation::where('user_id', $request->user()->id)->findOrFail($id);

        return response()->json(
            $conversation->messages()->orderBy('id')
                ->get(['id', 'sender_type', 'sender_agent', 'content', 'created_at'])
        );
    }

    private function startRun(int $companyId, int $clientId, string $mode, array $data, ?int $conversationId): AgentRun
    {
        $run = AgentRun::forceCreate([
            'company_id' => $companyId,
            'client_id' => $clientId,
            'conversation_id' => $conversationId,
            'agent' => 'main',
            'status' => 'running',
            'input' => [
                'mode' => $mode,
                'message' => $data['message'],
                'language' => $data['language'] ?? 'English',
            ],
            'started_at' => now(),
        ]);

        RunAgentRequest::dispatch($run->id);

        return $run;
    }
}
