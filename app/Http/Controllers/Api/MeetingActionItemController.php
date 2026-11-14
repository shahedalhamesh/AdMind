<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Meeting;
use App\Models\MeetingActionItem;
use App\Models\Task;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/** Decide what happens to an action item proposed from a meeting. */
class MeetingActionItemController extends Controller
{
    /**
     * Confirm: creates a task from the item (source "meeting").
     * Body (all optional): assignee_user_id or assignee_agent (default: the suggested assignee), due_at, priority, title.
     */
    public function confirm(Request $request, int $id): JsonResponse
    {
        $item = MeetingActionItem::findOrFail($id);
        abort_unless($item->status === 'proposed', 422, 'This item was already decided.');
        $meeting = Meeting::findOrFail($item->meeting_id);

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

        $userId = $data['assignee_user_id'] ?? (empty($data['assignee_agent']) ? $item->suggested_assignee_id : null);
        if ($userId) {
            User::where('company_id', $item->company_id)->whereNull('client_id')->where('status', 'active')->findOrFail($userId);
        }

        $task = DB::transaction(function () use ($item, $meeting, $data, $userId, $request) {
            $task = Task::forceCreate([
                'company_id' => $item->company_id,
                'client_id' => $meeting->client_id,
                'title' => $data['title'] ?? Str::limit($item->description, 120),
                'description' => $item->description . "\n\nFrom the meeting: {$meeting->title} (" . $meeting->held_at->toDateString() . ')',
                'type' => 'general',
                'source' => 'meeting',
                'priority' => $data['priority'] ?? 'medium',
                'status' => 'new',
                'due_at' => $data['due_at'] ?? $item->due_date,
                'assignee_type' => ! empty($data['assignee_agent']) ? 'agent' : 'user',
                'assignee_user_id' => $userId,
                'assignee_agent' => $data['assignee_agent'] ?? null,
                'created_by_type' => 'user',
                'created_by_id' => $request->user()->id,
            ]);
            $item->forceFill(['status' => 'confirmed', 'task_id' => $task->id])->save();

            return $task;
        });

        return response()->json(['action_item' => $item->fresh(), 'task' => $task], 201);
    }

    public function reject(int $id): JsonResponse
    {
        $item = MeetingActionItem::findOrFail($id);
        abort_unless($item->status === 'proposed', 422, 'This item was already decided.');
        $item->forceFill(['status' => 'rejected'])->save();

        return response()->json($item);
    }

    /** Fix the wording, assignee or date of a proposed item before confirming it. */
    public function update(Request $request, int $id): JsonResponse
    {
        $item = MeetingActionItem::findOrFail($id);
        abort_unless($item->status === 'proposed', 422, 'Only a proposed item can be edited.');

        $data = $request->validate([
            'description' => ['sometimes', 'string', 'max:2000'],
            'suggested_assignee_id' => ['sometimes', 'nullable', 'integer'],
            'due_date' => ['sometimes', 'nullable', 'date'],
        ]);
        if (! empty($data['suggested_assignee_id'])) {
            User::where('company_id', $item->company_id)->whereNull('client_id')->where('status', 'active')
                ->findOrFail($data['suggested_assignee_id']);
        }
        $item->update($data);

        return response()->json($item->fresh());
    }
}
