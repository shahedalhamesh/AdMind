<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Jobs\RunAgentRequest;
use App\Models\AgentRun;
use App\Models\Client;
use App\Models\Meeting;
use App\Models\MeetingActionItem;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Meetings with a client: the transcript (text for now) is summarized by the AI into a summary,
 * key insights and proposed action items. A person confirms an action item and it becomes a task.
 *
 * status: uploaded (has a transcript) -> processing (AI running) -> summarized | failed
 */
class MeetingController extends Controller
{
    /** Filters: client_id, status, per_page (max 100). */
    public function index(Request $request): JsonResponse
    {
        $query = Meeting::query()->orderByDesc('held_at')->orderByDesc('id');
        foreach (['client_id', 'status'] as $filter) {
            if ($request->filled($filter)) {
                $query->where($filter, $request->query($filter));
            }
        }

        $page = $query->select(['id', 'client_id', 'title', 'held_at', 'summary', 'status'])
            ->paginate(min((int) $request->query('per_page', 20), 100));

        $proposed = MeetingActionItem::whereIn('meeting_id', $page->pluck('id'))->where('status', 'proposed')
            ->selectRaw('meeting_id, count(*) as n')->groupBy('meeting_id')->pluck('n', 'meeting_id');
        $page->getCollection()->transform(fn ($m) => $m->setAttribute('proposed_count', (int) ($proposed[$m->id] ?? 0)));

        return response()->json($page);
    }

    public function show(int $id): JsonResponse
    {
        $meeting = Meeting::findOrFail($id);

        return response()->json([
            'meeting' => $meeting,
            'action_items' => MeetingActionItem::where('meeting_id', $meeting->id)->orderBy('id')->get(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'client_id' => ['required', 'integer'],
            'title' => ['required', 'string', 'max:255'],
            'held_at' => ['required', 'date'],
            'transcript' => ['nullable', 'string', 'max:50000'],
        ]);
        $client = Client::findOrFail($data['client_id']);

        $meeting = Meeting::forceCreate([
            'company_id' => $client->company_id,
            'client_id' => $client->id,
            'title' => $data['title'],
            'held_at' => $data['held_at'],
            'transcript' => $data['transcript'] ?? null,
            'status' => 'uploaded',
        ]);

        return response()->json($meeting->fresh(), 201);
    }

    /** Edit the details, the transcript, or correct the summary by hand. */
    public function update(Request $request, int $id): JsonResponse
    {
        $meeting = Meeting::findOrFail($id);
        abort_if($meeting->status === 'processing', 422, 'The AI is working on this meeting.');

        $data = $request->validate([
            'title' => ['sometimes', 'string', 'max:255'],
            'held_at' => ['sometimes', 'date'],
            'transcript' => ['sometimes', 'nullable', 'string', 'max:50000'],
            'summary' => ['sometimes', 'nullable', 'string'],
            'key_insights' => ['sometimes', 'nullable', 'array'],
            'key_insights.*' => ['string'],
        ]);
        $meeting->update($data);

        return response()->json($meeting->fresh());
    }

    public function destroy(int $id): JsonResponse
    {
        $meeting = Meeting::findOrFail($id);
        abort_if($meeting->status === 'processing', 422, 'The AI is working on this meeting.');
        $meeting->delete();

        return response()->json(['message' => 'Meeting deleted.']);
    }

    /**
     * Ask the AI to summarize the transcript. Returns 202 + agent_run_id (poll GET /agent/runs/{id}).
     * Proposed action items from an earlier run are replaced; confirmed ones are kept.
     */
    public function summarize(int $id): JsonResponse
    {
        $meeting = Meeting::findOrFail($id);
        abort_unless($meeting->client_id, 422, 'The meeting needs a client.');
        abort_if(blank($meeting->transcript), 422, 'The meeting has no transcript.');
        abort_if($meeting->status === 'processing', 422, 'The AI is already working on this meeting.');

        $client = Client::findOrFail($meeting->client_id);
        $team = User::where('company_id', $meeting->company_id)->whereNull('client_id')
            ->where('status', 'active')->orderBy('name')->pluck('name')->implode(', ');

        // items already decided in an earlier run must not be proposed again
        $decided = MeetingActionItem::where('meeting_id', $meeting->id)->whereIn('status', ['confirmed', 'rejected'])
            ->pluck('description')->map(fn ($d) => '- ' . $d)->implode("\n");
        $decidedNote = $decided === '' ? '' :
            "These action items were already decided. Do NOT include them again, nor any item that means the same thing:\n{$decided}\n";

        $message = "You are summarizing a meeting with the client \"{$client->name}\" for a marketing agency.\n"
            . "Write in the same language as the transcript.\n"
            . "Team members (use these exact names for assignees): {$team}\n"
            . "Reply with ONLY a JSON object, no other text, in exactly this shape:\n"
            . '{"summary": "3 to 6 sentences", "key_insights": ["short point"], '
            . '"action_items": [{"description": "what must be done", "assignee": "exact team member name or null", "due_date": "YYYY-MM-DD or null"}]}' . "\n"
            . "Only include action items that were clearly agreed in the meeting. Do not invent anything.\n"
            . $decidedNote
            . "Meeting title: {$meeting->title}\nDate: {$meeting->held_at->toDateString()}\n"
            . "Transcript:\n---\n{$meeting->transcript}\n---";

        $run = AgentRun::forceCreate([
            'company_id' => $meeting->company_id,
            'client_id' => $meeting->client_id,
            'agent' => 'main',
            'status' => 'running',
            'input' => ['mode' => 'meeting', 'meeting_id' => $meeting->id, 'message' => $message, 'language' => 'same as the transcript'],
            'started_at' => now(),
        ]);
        $meeting->forceFill(['status' => 'processing'])->save();

        RunAgentRequest::dispatch($run->id);

        return response()->json(['agent_run_id' => $run->id, 'status' => 'running'], 202);
    }

    /** Add an action item by hand. Body: description, suggested_assignee_id, due_date. */
    public function addActionItem(Request $request, int $id): JsonResponse
    {
        $meeting = Meeting::findOrFail($id);

        $data = $request->validate([
            'description' => ['required', 'string', 'max:2000'],
            'suggested_assignee_id' => ['nullable', 'integer'],
            'due_date' => ['nullable', 'date'],
        ]);
        if (! empty($data['suggested_assignee_id'])) {
            User::where('company_id', $meeting->company_id)->whereNull('client_id')->where('status', 'active')
                ->findOrFail($data['suggested_assignee_id']);
        }

        $item = MeetingActionItem::forceCreate([
            'company_id' => $meeting->company_id,
            'meeting_id' => $meeting->id,
            'description' => $data['description'],
            'suggested_assignee_id' => $data['suggested_assignee_id'] ?? null,
            'due_date' => $data['due_date'] ?? null,
            'status' => 'proposed',
        ]);

        return response()->json($item, 201);
    }
}
