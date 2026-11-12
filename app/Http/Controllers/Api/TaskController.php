<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Concerns\ResolvesCompany;
use App\Http\Controllers\Controller;
use App\Models\Client;
use App\Models\Task;
use App\Models\TaskDependency;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Tasks. A person with permission tasks.assign (Owner, Manager) sees and manages every task of
 * the company. Anyone else (Employee) only sees the tasks assigned to them and can only change
 * their status.
 */
class TaskController extends Controller
{
    use ResolvesCompany;

    private const STATUSES = ['new', 'in_progress', 'waiting_info', 'waiting_approval', 'completed', 'failed'];
    private const PRIORITIES = ['low', 'medium', 'high', 'urgent'];
    private const AGENTS = ['main', 'client', 'content', 'campaign', 'analytics'];

    /**
     * Filters: status (one or comma separated), priority, client_id, assignee_user_id,
     * mine=1, overdue=1, top_level=1 (no subtasks), per_page (max 100).
     */
    public function index(Request $request): JsonResponse
    {
        $query = $this->visible($request)
            ->with(['assigneeUser:id,name', 'client:id,name'])
            ->withCount('subtasks')
            ->orderByRaw("FIELD(priority, 'urgent', 'high', 'medium', 'low')")
            ->orderByRaw('due_at IS NULL')
            ->orderBy('due_at')
            ->orderByDesc('id');

        if ($request->filled('status')) {
            $query->whereIn('status', explode(',', $request->query('status')));
        }
        foreach (['priority', 'client_id', 'assignee_user_id'] as $filter) {
            if ($request->filled($filter)) {
                $query->where($filter, $request->query($filter));
            }
        }
        if ($request->boolean('mine')) {
            $query->where('assignee_user_id', $request->user()->id);
        }
        if ($request->boolean('overdue')) {
            $query->where('due_at', '<', now())->whereNotIn('status', ['completed', 'failed']);
        }
        if ($request->boolean('top_level')) {
            $query->whereNull('parent_task_id');
        }

        return response()->json($query->paginate(min((int) $request->query('per_page', 20), 100)));
    }

    public function show(Request $request, int $id): JsonResponse
    {
        $task = $this->visible($request)
            ->with(['assigneeUser:id,name', 'client:id,name', 'parentTask:id,title', 'contentItems:id,task_id,title,status,type,platform'])
            ->findOrFail($id);

        $dependsOn = Task::whereIn('id', TaskDependency::where('task_id', $task->id)->pluck('depends_on_task_id'))
            ->get(['id', 'title', 'status']);

        return response()->json([
            'task' => $task,
            'subtasks' => $task->subtasks()->orderBy('id')->get(['id', 'title', 'status', 'assignee_user_id', 'due_at']),
            'depends_on' => $dependsOn,
            'blocked' => $dependsOn->contains(fn ($t) => $t->status !== 'completed'),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $companyId = $this->companyId($request);

        $data = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'type' => ['nullable', 'string', 'max:50'],
            'client_id' => ['nullable', 'integer'],
            'parent_task_id' => ['nullable', 'integer'],
            'assignee_user_id' => ['nullable', 'integer'],
            'assignee_agent' => ['nullable', Rule::in(self::AGENTS)],
            'priority' => ['nullable', Rule::in(self::PRIORITIES)],
            'due_at' => ['nullable', 'date'],
        ]);

        if (! empty($data['client_id'])) {
            Client::where('company_id', $companyId)->findOrFail($data['client_id']);
        }
        if (! empty($data['parent_task_id'])) {
            Task::where('company_id', $companyId)->findOrFail($data['parent_task_id']);
        }

        $task = Task::forceCreate([
            'company_id' => $companyId,
            'client_id' => $data['client_id'] ?? null,
            'parent_task_id' => $data['parent_task_id'] ?? null,
            'title' => $data['title'],
            'description' => $data['description'] ?? null,
            'type' => $data['type'] ?? 'general',
            'source' => 'manager',
            'priority' => $data['priority'] ?? 'medium',
            'status' => 'new',
            'due_at' => $data['due_at'] ?? null,
            'created_by_type' => 'user',
            'created_by_id' => $request->user()->id,
        ] + $this->assignee($companyId, $data));

        return response()->json($task->load(['assigneeUser:id,name', 'client:id,name']), 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        $task = $this->visible($request)->findOrFail($id);
        $canManage = $user->hasPermission('tasks.assign');
        $companyId = (int) $task->company_id;

        $rules = ['status' => ['sometimes', Rule::in(self::STATUSES)]];
        if ($canManage) {
            $rules += [
                'title' => ['sometimes', 'string', 'max:255'],
                'description' => ['sometimes', 'nullable', 'string'],
                'type' => ['sometimes', 'string', 'max:50'],
                'client_id' => ['sometimes', 'nullable', 'integer'],
                'parent_task_id' => ['sometimes', 'nullable', 'integer'],
                'assignee_user_id' => ['sometimes', 'nullable', 'integer'],
                'assignee_agent' => ['sometimes', 'nullable', Rule::in(self::AGENTS)],
                'priority' => ['sometimes', Rule::in(self::PRIORITIES)],
                'due_at' => ['sometimes', 'nullable', 'date'],
            ];
        }
        // Without tasks.assign only "status" is accepted: other fields are ignored
        $data = $request->validate($rules);

        if (! empty($data['client_id'])) {
            Client::where('company_id', $companyId)->findOrFail($data['client_id']);
        }
        if (! empty($data['parent_task_id'])) {
            $parentId = (int) $data['parent_task_id'];
            Task::where('company_id', $companyId)->findOrFail($parentId);
            if ($this->makesParentCycle($task->id, $parentId)) {
                throw ValidationException::withMessages(['parent_task_id' => 'A task cannot be its own parent or sit under its own subtask.']);
            }
        }

        $changes = collect($data)->except(['assignee_user_id', 'assignee_agent'])->all();
        if (array_key_exists('assignee_user_id', $data) || array_key_exists('assignee_agent', $data)) {
            $changes += $this->assignee($companyId, $data);
        }

        if (isset($data['status']) && $data['status'] !== $task->status) {
            if ($data['status'] === 'completed') {
                $blocked = TaskDependency::where('task_id', $task->id)
                    ->whereIn('depends_on_task_id', Task::where('status', '!=', 'completed')->select('id'))->exists();
                abort_if($blocked, 422, 'This task is blocked by unfinished tasks.');
                $changes['completed_at'] = now();
            } else {
                $changes['completed_at'] = null;
            }
            if ($data['status'] === 'in_progress' && ! $task->started_at) {
                $changes['started_at'] = now();
            }
        }

        $task->update($changes);

        return response()->json($task->fresh(['assigneeUser:id,name', 'client:id,name']));
    }

    /** Deletes the task and its subtasks. */
    public function destroy(int $id): JsonResponse
    {
        Task::findOrFail($id)->delete();

        return response()->json(['message' => 'Task deleted.']);
    }

    /** "This task cannot finish before another task finishes". Body: {"depends_on_task_id": 5} */
    public function addDependency(Request $request, int $id): JsonResponse
    {
        $task = Task::findOrFail($id);
        $data = $request->validate(['depends_on_task_id' => ['required', 'integer']]);
        $other = Task::where('company_id', $task->company_id)->findOrFail($data['depends_on_task_id']);

        if ($other->id === $task->id) {
            throw ValidationException::withMessages(['depends_on_task_id' => 'A task cannot depend on itself.']);
        }
        if (TaskDependency::where('task_id', $task->id)->where('depends_on_task_id', $other->id)->exists()) {
            throw ValidationException::withMessages(['depends_on_task_id' => 'This dependency already exists.']);
        }
        if ($this->makesDependencyCycle($task->id, $other->id)) {
            throw ValidationException::withMessages(['depends_on_task_id' => 'This would create a circular dependency.']);
        }

        TaskDependency::forceCreate([
            'company_id' => $task->company_id,
            'task_id' => $task->id,
            'depends_on_task_id' => $other->id,
        ]);

        return response()->json(['depends_on' => $this->dependsOn($task->id)], 201);
    }

    public function removeDependency(int $id, int $dependsOnId): JsonResponse
    {
        $task = Task::findOrFail($id);
        TaskDependency::where('task_id', $task->id)->where('depends_on_task_id', $dependsOnId)->delete();

        return response()->json(['depends_on' => $this->dependsOn($task->id)]);
    }

    // ---------------------------------------------------------------- helpers

    private function visible(Request $request): Builder
    {
        $query = Task::query();
        $user = $request->user();

        if ($user->company_id !== null && ! $user->hasPermission('tasks.assign')) {
            $query->where('assignee_user_id', $user->id);
        }

        return $query;
    }

    /** Fields for assignee_type / assignee_user_id / assignee_agent. Only one of the two may be sent. */
    private function assignee(int $companyId, array $data): array
    {
        $userId = $data['assignee_user_id'] ?? null;
        $agent = $data['assignee_agent'] ?? null;

        if ($userId && $agent) {
            throw ValidationException::withMessages(['assignee_user_id' => 'Assign the task to a person or to an agent, not both.']);
        }
        if ($agent) {
            return ['assignee_type' => 'agent', 'assignee_user_id' => null, 'assignee_agent' => $agent];
        }
        if ($userId) {
            // staff only: a client's own login cannot be assigned work
            User::where('company_id', $companyId)->whereNull('client_id')->where('status', 'active')->findOrFail($userId);
        }

        return ['assignee_type' => 'user', 'assignee_user_id' => $userId, 'assignee_agent' => null];
    }

    /** True when $parentId is $taskId itself or one of its descendants. */
    private function makesParentCycle(int $taskId, int $parentId): bool
    {
        $cursor = $parentId;
        for ($i = 0; $i < 50 && $cursor; $i++) {
            if ($cursor === $taskId) {
                return true;
            }
            $cursor = Task::whereKey($cursor)->value('parent_task_id');
        }

        return false;
    }

    /** True when $dependsOnId already depends (directly or not) on $taskId. */
    private function makesDependencyCycle(int $taskId, int $dependsOnId): bool
    {
        $seen = [];
        $queue = [$dependsOnId];
        while ($queue) {
            $node = array_pop($queue);
            if (isset($seen[$node])) {
                continue;
            }
            $seen[$node] = true;
            foreach (TaskDependency::where('task_id', $node)->pluck('depends_on_task_id') as $next) {
                if ($next === $taskId) {
                    return true;
                }
                $queue[] = $next;
            }
        }

        return false;
    }

    private function dependsOn(int $taskId)
    {
        return Task::whereIn('id', TaskDependency::where('task_id', $taskId)->pluck('depends_on_task_id'))
            ->get(['id', 'title', 'status']);
    }
}
