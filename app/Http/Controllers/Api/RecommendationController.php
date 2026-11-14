<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Jobs\RunAgentRequest;
use App\Models\AgentRun;
use App\Models\Client;
use App\Models\Recommendation;
use App\Models\Task;
use App\Models\User;
use App\Services\ReportService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * The AI reads a client's performance numbers and proposes next actions.
 * A person accepts one (it becomes a task) or dismisses it.
 *
 * Stored in the existing table: `recommendation` is the text, `based_on` holds
 * {title, reason, priority, period, agent_run_id, task_id}.
 */
class RecommendationController extends Controller
{
    /** Filters: client_id (required), status (new|accepted|dismissed). */
    public function index(Request $request): JsonResponse
    {
        $request->validate(['client_id' => ['required', 'integer']]);
        $client = Client::findOrFail($request->query('client_id'));

        $query = Recommendation::where('client_id', $client->id)->orderByDesc('id');
        if ($request->filled('status')) {
            $query->where('status', $request->query('status'));
        }

        return response()->json($query->paginate(min((int) $request->query('per_page', 20), 100)));
    }

    /**
     * Ask the AI for recommendations. Body: client_id, days (7 to 180, default 30), language (default English).
     * Returns 202 + agent_run_id (poll GET /agent/runs/{id}). Open (new) recommendations of an earlier run are replaced.
     */
    public function generate(Request $request): JsonResponse
    {
        $data = $request->validate([
            'client_id' => ['required', 'integer'],
            'days' => ['nullable', 'integer', 'min:7', 'max:180'],
            'language' => ['nullable', 'string', 'max:40'],
        ]);
        $client = Client::findOrFail($data['client_id']);
        $days = $data['days'] ?? 30;
        $language = $data['language'] ?? 'English';

        $to = Carbon::today();
        $from = $to->copy()->subDays($days - 1);
        $report = ReportService::clientReport($client, $from, $to);
        abort_unless($report['has_metrics'], 422, 'There are no performance numbers for this client in this period.');

        $decided = Recommendation::where('client_id', $client->id)->whereIn('status', ['accepted', 'dismissed'])
            ->orderByDesc('id')->limit(15)->get()
            ->map(fn ($r) => '- ' . ($r->based_on['title'] ?? Str::limit($r->recommendation, 80)) . " ({$r->status})")->implode("\n");
        $decidedNote = $decided === '' ? '' :
            "These recommendations were already decided. Do NOT repeat them or anything that means the same:\n{$decided}\n";

        $numbers = json_encode([
            'period' => $report['period'], 'totals' => $report['totals'], 'by_platform' => $report['by_platform'],
            'published_count' => $report['content']['published_count'], 'top_content' => $report['content']['top'],
            'goals' => $report['goals'], 'campaigns' => $report['campaigns'],
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

        $message = "You are the analytics advisor of a marketing agency. Client: \"{$client->name}\".\n"
            . "Below are the client's real performance numbers for the last {$days} days (JSON). Write in {$language}.\n"
            . "Give 3 to 5 concrete recommendations the team can act on next (what to post, change, stop or test).\n"
            . "Base every recommendation ONLY on these numbers and the client's known profile; never invent numbers.\n"
            . "Reply with ONLY a JSON object, no other text, in exactly this shape:\n"
            . '{"recommendations": [{"title": "short action title", "recommendation": "what to do, 1 to 3 sentences", '
            . '"reason": "which numbers support it", "priority": "low|medium|high"}]}' . "\n"
            . $decidedNote
            . "Numbers:\n{$numbers}";

        $run = AgentRun::forceCreate([
            'company_id' => $client->company_id,
            'client_id' => $client->id,
            'agent' => 'analytics',
            'status' => 'running',
            'input' => ['mode' => 'recommend', 'message' => $message, 'language' => $language,
                'period' => $report['period']],
            'started_at' => now(),
        ]);

        RunAgentRequest::dispatch($run->id);

        return response()->json(['agent_run_id' => $run->id, 'status' => 'running'], 202);
    }

    /**
     * Accept: creates a task from the recommendation (source "agent").
     * Body (all optional): assignee_user_id or assignee_agent, due_at, priority, title.
     */
    public function accept(Request $request, int $id): JsonResponse
    {
        $rec = Recommendation::findOrFail($id);
        abort_unless($rec->status === 'new', 422, 'This recommendation was already decided.');

        $data = $request->validate([
            'assignee_user_id' => ['nullable', 'integer'],
            'assignee_agent' => ['nullable', Rule::in(['main', 'client', 'content', 'campaign', 'analytics'])],
            'due_at' => ['nullable', 'date'],
            'priority' => ['nullable', Rule::in(['low', 'medium', 'high', 'urgent'])],
            'title' => ['nullable', 'string', 'max:255'],
        ]);
        if (! empty($data['assignee_user_id']) && ! empty($data['assignee_agent'])) {
            throw ValidationException::withMessages(['assignee_user_id' => 'Assign the task to a person or to an agent, not both.']);
        }
        if (! empty($data['assignee_user_id'])) {
            User::where('company_id', $rec->company_id)->whereNull('client_id')->where('status', 'active')
                ->findOrFail($data['assignee_user_id']);
        }

        $info = $rec->based_on ?? [];
        $task = DB::transaction(function () use ($rec, $data, $info, $request) {
            $task = Task::forceCreate([
                'company_id' => $rec->company_id,
                'client_id' => $rec->client_id,
                'title' => $data['title'] ?? Str::limit($info['title'] ?? $rec->recommendation, 120),
                'description' => $rec->recommendation . (empty($info['reason']) ? '' : "\n\nWhy: {$info['reason']}"),
                'type' => 'general',
                'source' => 'agent',
                'priority' => $data['priority'] ?? (in_array($info['priority'] ?? null, ['low', 'medium', 'high'], true) ? $info['priority'] : 'medium'),
                'status' => 'new',
                'due_at' => $data['due_at'] ?? null,
                'assignee_type' => ! empty($data['assignee_agent']) ? 'agent' : 'user',
                'assignee_user_id' => $data['assignee_user_id'] ?? null,
                'assignee_agent' => $data['assignee_agent'] ?? null,
                'created_by_type' => 'user',
                'created_by_id' => $request->user()->id,
            ]);
            $rec->forceFill(['status' => 'accepted', 'based_on' => array_merge($info, ['task_id' => $task->id])])->save();

            return $task;
        });

        return response()->json(['recommendation' => $rec->fresh(), 'task' => $task], 201);
    }

    public function dismiss(int $id): JsonResponse
    {
        $rec = Recommendation::findOrFail($id);
        abort_unless($rec->status === 'new', 422, 'This recommendation was already decided.');
        $rec->forceFill(['status' => 'dismissed'])->save();

        return response()->json($rec);
    }
}
