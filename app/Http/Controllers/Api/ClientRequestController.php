<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Client;
use App\Models\ClientRequest;
use App\Models\Task;
use App\Models\User;
use App\Services\ContentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Requests a client sends to the agency from its portal (a new post, a campaign, a report, a complaint...).
 * The team turns a request into a task, or rejects it.
 *
 * status: new -> in_progress (a task was created) -> completed (that task is completed) | rejected
 */
class ClientRequestController extends Controller
{
    /** The client's own login sends a request. Body: type, subject, description, priority (default medium). */
    public function store(Request $request): JsonResponse
    {
        $user = $request->user();
        abort_unless($user->client_id, 403, 'Only a client can send a request.');

        $data = $request->validate([
            'type' => ['required', Rule::in(['content', 'campaign', 'report', 'complaint', 'other'])],
            'priority' => ['nullable', Rule::in(['low', 'medium', 'high', 'urgent'])],
            'subject' => ['required', 'string', 'max:255'],
            'description' => ['required', 'string', 'max:5000'],
        ]);
        $client = Client::findOrFail($user->client_id);

        $item = ClientRequest::forceCreate([
            'company_id' => $client->company_id,
            'client_id' => $client->id,
            'submitted_by_user_id' => $user->id,
            'type' => $data['type'],
            'priority' => $data['priority'] ?? 'medium',
            'subject' => $data['subject'],
            'description' => $data['description'],
            'status' => 'new',
        ]);

        ContentService::notify($client->company_id, ContentService::reviewerIds($client->company_id, $client), 'client_request',
            "New request from {$client->name}: {$item->subject}", Str::limit($item->description, 200),
            ['client_request_id' => $item->id, 'client_id' => $client->id]);

        return response()->json($item, 201);
    }

    /** Filters: client_id, status, type, per_page (max 100). A client login only sees its own requests. */
    public function index(Request $request): JsonResponse
    {
        $query = $this->visible($request)->with(['client:id,name', 'task:id,title,status'])->orderByDesc('id');
        foreach (['client_id', 'status', 'type'] as $filter) {
            if ($request->filled($filter)) {
                $query->where($filter, $request->query($filter));
            }
        }
        $page = $query->paginate(min((int) $request->query('per_page', 20), 100));
        $page->getCollection()->each(fn ($r) => $this->syncCompleted($r));

        return response()->json($page);
    }

    public function show(Request $request, int $id): JsonResponse
    {
        $item = $this->visible($request)->with(['client:id,name', 'task:id,title,status,due_at'])->findOrFail($id);
        $this->syncCompleted($item);

        return response()->json($item);
    }

    /**
     * Turn the request into a task (source "client_request").
     * Body (all optional): assignee_user_id or assignee_agent, due_at, priority, title.
     */
    public function convert(Request $request, int $id): JsonResponse
    {
        $item = ClientRequest::findOrFail($id);
        abort_unless($item->status === 'new', 422, 'This request was already handled.');

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
            User::where('company_id', $item->company_id)->whereNull('client_id')->where('status', 'active')
                ->findOrFail($data['assignee_user_id']);
        }

        $task = DB::transaction(function () use ($item, $data, $request) {
            $task = Task::forceCreate([
                'company_id' => $item->company_id,
                'client_id' => $item->client_id,
                'title' => $data['title'] ?? Str::limit($item->subject, 120),
                'description' => $item->description . "\n\nFrom a client request ({$item->type}).",
                'type' => in_array($item->type, ['content', 'campaign', 'report'], true) ? $item->type : 'general',
                'source' => 'client_request',
                'priority' => $data['priority'] ?? $item->priority,
                'status' => 'new',
                'due_at' => $data['due_at'] ?? null,
                'assignee_type' => ! empty($data['assignee_agent']) ? 'agent' : 'user',
                'assignee_user_id' => $data['assignee_user_id'] ?? null,
                'assignee_agent' => $data['assignee_agent'] ?? null,
                'created_by_type' => 'user',
                'created_by_id' => $request->user()->id,
            ]);
            $item->forceFill(['status' => 'in_progress', 'task_id' => $task->id])->save();

            return $task;
        });

        $this->tellClient($item, 'Your request was accepted', $item->subject);

        return response()->json(['request' => $item->fresh(), 'task' => $task], 201);
    }

    /** Body: reason (optional, shown to the client in a notification). */
    public function reject(Request $request, int $id): JsonResponse
    {
        $item = ClientRequest::findOrFail($id);
        abort_unless($item->status === 'new', 422, 'This request was already handled.');
        $data = $request->validate(['reason' => ['nullable', 'string', 'max:1000']]);

        $item->forceFill(['status' => 'rejected'])->save();
        $this->tellClient($item, 'Your request was declined', trim($item->subject . (filled($data['reason'] ?? null) ? ': ' . $data['reason'] : '')));

        return response()->json($item);
    }

    // ------------------------------------------------------------ helpers

    private function visible(Request $request)
    {
        $user = $request->user();
        $query = ClientRequest::query();
        if ($user->client_id) {
            return $query->where('client_id', $user->client_id);
        }
        abort_unless($user->hasPermission('clients.view'), 403, 'You do not have permission to do this.');

        return $query;
    }

    /** A request becomes completed when its task is completed. */
    private function syncCompleted(ClientRequest $item): void
    {
        if ($item->status === 'in_progress' && $item->task && $item->task->status === 'completed') {
            $item->forceFill(['status' => 'completed'])->save();
        }
    }

    private function tellClient(ClientRequest $item, string $title, ?string $body): void
    {
        if ($item->submitted_by_user_id) {
            ContentService::notify($item->company_id, [$item->submitted_by_user_id], 'request_update', $title, $body,
                ['client_request_id' => $item->id]);
        }
    }
}
