<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AgentRun;
use App\Models\Approval;
use App\Models\Campaign;
use App\Models\Client;
use App\Models\ContentItem;
use App\Models\ContentVersion;
use App\Models\Task;
use App\Models\User;
use App\Jobs\SendAiFeedback;
use App\Services\ContentService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/**
 * Content items (posts, reels, ads...) with versions and the approval request.
 *
 * Status flow:
 *   draft --submit--> in_review --approve--> approved
 *                         |--changes requested--> revision_requested --new version--> draft
 *                         |--rejected---------------------------------> draft
 *   A new version of an approved item sends it back to draft.
 */
class ContentController extends Controller
{
    private const TYPES = ['post', 'reel', 'video', 'story', 'ad'];
    private const PLATFORMS = ['instagram', 'facebook', 'tiktok', 'x', 'linkedin', 'snapchat'];
    private const EDITABLE = ['idea', 'draft', 'revision_requested', 'approved'];

    /** Filters: client_id, status, type, platform, per_page (max 100). */
    public function index(Request $request): JsonResponse
    {
        $query = $this->visible($request)->with('currentVersion')->orderByDesc('id');

        foreach (['client_id', 'status', 'type', 'platform'] as $filter) {
            if ($request->filled($filter)) {
                $query->where($filter, $request->query($filter));
            }
        }

        return response()->json($query->paginate(min((int) $request->query('per_page', 20), 100)));
    }

    public function show(Request $request, int $id): JsonResponse
    {
        $item = $this->visible($request)->with(['currentVersion', 'client:id,name'])->findOrFail($id);

        return response()->json([
            'content' => $item,
            'versions' => $item->versions()->orderByDesc('version_number')->get(),
            'approvals' => Approval::where('subject_type', 'content_item')
                ->where('subject_id', $item->id)->orderByDesc('id')->get(),
        ]);
    }

    /**
     * Create a content item with its first version. Send `body` (written by the employee), or
     * `agent_run_id` to use the output of a finished AI run as the first version.
     */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'client_id' => ['required', 'integer'],
            'type' => ['required', Rule::in(self::TYPES)],
            'platform' => ['required', Rule::in(self::PLATFORMS)],
            'title' => ['required', 'string', 'max:255'],
            'language' => ['nullable', Rule::in(['ar', 'en'])],
            'body' => ['required_without:agent_run_id', 'nullable', 'string'],
            'hashtags' => ['nullable', 'array'],
            'hashtags.*' => ['string'],
            'script' => ['nullable', 'string'],
            'campaign_id' => ['nullable', 'integer'],
            'task_id' => ['nullable', 'integer'],
            'agent_run_id' => ['nullable', 'integer'],
        ]);

        $user = $request->user();
        $client = Client::findOrFail($data['client_id']);

        // company scope: these are 404 when they belong to another company
        if (! empty($data['campaign_id'])) {
            Campaign::where('client_id', $client->id)->findOrFail($data['campaign_id']);
        }
        if (! empty($data['task_id'])) {
            Task::findOrFail($data['task_id']);
        }

        $run = null;
        if (! empty($data['agent_run_id'])) {
            $run = AgentRun::where('client_id', $client->id)->where('status', 'succeeded')
                ->findOrFail($data['agent_run_id']);
        }

        $body = $data['body'] ?? $run->output;
        $fromAgent = empty($data['body']) && $run !== null;

        $item = DB::transaction(function () use ($data, $client, $user, $run, $body, $fromAgent) {
            $item = ContentItem::forceCreate([
                'company_id' => $client->company_id,
                'client_id' => $client->id,
                'campaign_id' => $data['campaign_id'] ?? null,
                'task_id' => $data['task_id'] ?? null,
                'type' => $data['type'],
                'platform' => $data['platform'],
                'title' => $data['title'],
                'status' => 'draft',
                'created_by_type' => 'user',
                'created_by_id' => $user->id,
                'source_run_id' => $run?->id,
                'is_example' => false,
            ]);

            $version = ContentService::createVersion($item, [
                'body' => $body,
                'language' => $data['language'] ?? ContentService::detectLanguage($body),
                'hashtags' => $data['hashtags'] ?? [],
                'script' => $data['script'] ?? null,
                'instruction' => null,
            ], $fromAgent ? 'agent' : 'user', $fromAgent ? null : $user->id, $run?->id);

            $item->forceFill(['current_version_id' => $version->id])->save();

            return $item;
        });

        return response()->json($item->load('currentVersion'), 201);
    }

    /** Change the details (title, type, platform...). The text itself changes through versions. */
    public function update(Request $request, int $id): JsonResponse
    {
        $item = ContentItem::findOrFail($id);
        abort_if($item->status === 'published', 422, 'Published content cannot be changed.');

        $data = $request->validate([
            'title' => ['sometimes', 'string', 'max:255'],
            'type' => ['sometimes', Rule::in(self::TYPES)],
            'platform' => ['sometimes', Rule::in(self::PLATFORMS)],
            'campaign_id' => ['nullable', 'integer'],
            'task_id' => ['nullable', 'integer'],
        ]);

        if (! empty($data['campaign_id'])) {
            Campaign::where('client_id', $item->client_id)->findOrFail($data['campaign_id']);
        }
        if (! empty($data['task_id'])) {
            Task::findOrFail($data['task_id']);
        }

        $item->update($data);

        return response()->json($item->load('currentVersion'));
    }

    /** Save a new version of the text. Needs status idea, draft, revision_requested or approved. */
    public function addVersion(Request $request, int $id): JsonResponse
    {
        $item = ContentItem::findOrFail($id);
        abort_unless(
            in_array($item->status, self::EDITABLE, true),
            422,
            'This content cannot be edited in its current status.'
        );

        $data = $request->validate([
            'body' => ['required', 'string'],
            'language' => ['nullable', Rule::in(['ar', 'en'])],
            'hashtags' => ['nullable', 'array'],
            'hashtags.*' => ['string'],
            'script' => ['nullable', 'string'],
            'instruction' => ['nullable', 'string', 'max:2000'],
        ]);

        $user = $request->user();

        $version = DB::transaction(function () use ($item, $data, $user) {
            $version = ContentService::createVersion($item, [
                'body' => $data['body'],
                'language' => $data['language'] ?? ContentService::detectLanguage($data['body']),
                'hashtags' => $data['hashtags'] ?? [],
                'script' => $data['script'] ?? null,
                'instruction' => $data['instruction'] ?? null,
            ], 'user', $user->id, null);

            $item->forceFill(['current_version_id' => $version->id, 'status' => 'draft'])->save();

            return $version;
        });

        return response()->json($version, 201);
    }

    /**
     * Send a draft for approval. Stage 1: a person without approvals.manage (an employee) sends it to a Manager
     * (internal review); the client sees nothing yet. A Manager or Owner sends it straight to the client
     * (stage 2): by default to the client's own login, else to the client's responsible employee;
     * `requested_from_id` (optional) overrides the approver.
     */
    public function submit(Request $request, int $id): JsonResponse
    {
        $item = ContentItem::findOrFail($id);
        abort_unless($item->status === 'draft' && $item->current_version_id, 422, 'Only a draft with a version can be submitted.');

        $data = $request->validate(['requested_from_id' => ['nullable', 'integer']]);

        $internal = ! $request->user()->hasPermission('approvals.manage');

        $approval = DB::transaction(fn () => $internal
            ? ContentService::requestInternalReview($item, $request->user()->id)
            : ContentService::requestClientApproval($item, $data['requested_from_id'] ?? null, $request->user()->id));

        return response()->json([
            'stage' => $internal ? 'internal' : 'client',
            'content_status' => $item->status,
            'approval' => $approval,
        ], 201);
    }

    /**
     * The employee reviewed the text and gives notes: the AI rewrites it and saves a new version
     * (status back to draft). Returns 202 + agent_run_id; poll GET /agent/runs/{id}.
     */
    public function revise(Request $request, int $id): JsonResponse
    {
        $item = ContentItem::with('currentVersion')->findOrFail($id);
        abort_unless(
            in_array($item->status, ['draft', 'revision_requested', 'approved'], true) && $item->currentVersion,
            422,
            'This content cannot be revised in its current status.'
        );

        $data = $request->validate(['notes' => ['required', 'string', 'max:4000']]);

        $busy = AgentRun::where('status', 'running')->where('client_id', $item->client_id)
            ->where('input->content_id', $item->id)->exists();
        abort_if($busy, 422, 'The AI is already working on this content.');

        // The notes are negative feedback on the version the AI wrote before
        $episodeId = $item->currentVersion->agent_run_id
            ? AgentRun::whereKey($item->currentVersion->agent_run_id)->value('episode_id') : null;
        if ($episodeId) {
            SendAiFeedback::dispatch($item->company_id, (int) $episodeId, 'rejected', $data['notes']);
        }

        $run = ContentService::startRevision($item, $data['notes']);

        return response()->json(['agent_run_id' => $run->id, 'status' => 'running'], 202);
    }

    // ---------------------------------------------------------------- helpers

    /** A client's own login only sees its client's content, and never ideas or drafts. */
    private function visible(Request $request): Builder
    {
        $query = ContentItem::query();
        $user = $request->user();

        if ($user->client_id) {
            $query->where('client_id', $user->client_id)->whereNotIn('status', ['idea', 'draft']);
        }

        return $query;
    }
}
