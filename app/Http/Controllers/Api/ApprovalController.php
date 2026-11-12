<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Jobs\SendAiFeedback;
use App\Models\AgentRun;
use App\Models\Approval;
use App\Models\Client;
use App\Models\ContentItem;
use App\Models\Task;
use App\Services\ContentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class ApprovalController extends Controller
{
    /**
     * Approval requests. A manager (permission approvals.manage) sees the whole company,
     * anyone else sees only the requests sent to them. Filter: ?status=pending
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $query = Approval::query()->orderByDesc('id');

        if (! $user->hasPermission('approvals.manage')) {
            $query->where('requested_from_id', $user->id);
        }
        if ($request->filled('status')) {
            $query->where('status', $request->query('status'));
        }

        $approvals = $query->get();

        $items = ContentItem::with(['currentVersion', 'client:id,name'])
            ->whereIn('id', $approvals->where('subject_type', 'content_item')->pluck('subject_id'))
            ->get()->keyBy('id');

        return response()->json($approvals->map(fn (Approval $a) => $a->toArray() + [
            'content' => $a->subject_type === 'content_item' ? ($items[$a->subject_id] ?? null) : null,
        ])->values());
    }

    /** Decide a pending request: approved, rejected or changes_requested (comment required unless approved). */
    public function decide(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        $approval = Approval::findOrFail($id);

        abort_unless(
            $approval->requested_from_id === $user->id || $user->hasPermission('approvals.manage'),
            403,
            'This approval request was not sent to you.'
        );
        abort_unless($approval->status === 'pending', 422, 'This request was already decided.');
        abort_unless($approval->subject_type === 'content_item', 422, 'Unsupported approval subject.');

        $data = $request->validate([
            'decision' => ['required', Rule::in(['approved', 'rejected', 'changes_requested'])],
            'comment' => ['required_unless:decision,approved', 'nullable', 'string', 'max:2000'],
        ]);

        $item = ContentItem::findOrFail($approval->subject_id);
        abort_unless($item->status === 'in_review', 422, 'The content is not waiting for review.');

        $newStatus = match ($data['decision']) {
            'approved' => 'approved',
            'changes_requested' => 'revision_requested',
            'rejected' => 'draft',
        };

        DB::transaction(function () use ($approval, $item, $data, $newStatus) {
            $approval->forceFill([
                'status' => $data['decision'],
                'comment' => $data['comment'] ?? null,
                'decided_at' => now(),
            ])->save();
            $item->forceFill(['status' => $newStatus])->save();
        });

        // Teach the AI: only when the text being judged is what the AI wrote (the current
        // version came from an AI run). A version edited by a person is not the AI's work.
        $versionRunId = $item->currentVersion?->agent_run_id;
        $episodeId = $versionRunId ? AgentRun::whereKey($versionRunId)->value('episode_id') : null;
        if ($episodeId) {
            SendAiFeedback::dispatch(
                $approval->company_id,
                (int) $episodeId,
                $data['decision'] === 'approved' ? 'approved' : 'rejected', // "changes requested" is negative feedback too
                (string) ($data['comment'] ?? '')
            );
        }

        // A content item that came from a task moves the task along
        if ($item->task_id) {
            $task = Task::find($item->task_id);
            if ($task) {
                $task->forceFill($data['decision'] === 'approved'
                    ? ['status' => 'completed', 'completed_at' => now()]
                    : ['status' => 'in_progress', 'completed_at' => null])->save();
            }
        }

        // Tell the people who reviewed it (not the one who just decided)
        $reviewers = array_diff(
            ContentService::reviewerIds($approval->company_id, Client::find($item->client_id)),
            [$user->id]
        );
        ContentService::notify($approval->company_id, $reviewers,
            $data['decision'] === 'approved' ? 'content_approved' : 'client_feedback',
            ($data['decision'] === 'approved' ? 'Approved: ' : 'Changes requested: ') . $item->title,
            $data['comment'] ?? null,
            ['content_id' => $item->id, 'task_id' => $item->task_id, 'decision' => $data['decision']]);

        return response()->json(['approval' => $approval, 'content_status' => $newStatus]);
    }
}
