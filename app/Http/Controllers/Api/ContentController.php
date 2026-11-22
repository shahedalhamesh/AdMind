<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AgentRun;
use App\Models\Approval;
use App\Models\Campaign;
use App\Models\Client;
use App\Models\ContentItem;
use App\Models\ContentVersion;
use App\Models\MediaAsset;
use App\Models\Task;
use App\Models\User;
use App\Jobs\SendAiFeedback;
use App\Services\ContentService;
use App\Services\StuckWork;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
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
     * Create a content item with its first version. Send one of:
     *  - `body` (or `caption`): the text written by the employee,
     *  - `agent_run_id`: use the output of a finished AI run as the first version,
     *  - `media_id`: start a post from a ready image or video of the same client (caption optional).
     * With `media_id`, `type` (image -> post, video -> reel), `platform` (instagram) and `title` (from the
     * caption) are filled in when not sent, and the media is attached to the new item.
     */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'client_id' => ['required', 'integer'],
            'type' => ['required_without:media_id', 'nullable', Rule::in(self::TYPES)],
            'platform' => ['required_without:media_id', 'nullable', Rule::in(self::PLATFORMS)],
            'title' => ['required_without:media_id', 'nullable', 'string', 'max:255'],
            'language' => ['nullable', Rule::in(['ar', 'en'])],
            'body' => ['required_without_all:agent_run_id,media_id,caption', 'nullable', 'string'],
            'caption' => ['nullable', 'string'],
            'hashtags' => ['nullable', 'array'],
            'hashtags.*' => ['string'],
            'script' => ['nullable', 'string'],
            'campaign_id' => ['nullable', 'integer'],
            'task_id' => ['nullable', 'integer'],
            'agent_run_id' => ['nullable', 'integer'],
            'media_id' => ['nullable', 'integer'],
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

        $media = null;
        if (! empty($data['media_id'])) {
            $media = MediaAsset::where('client_id', $client->id)->where('status', 'ready')
                ->findOrFail($data['media_id']);
            abort_if($media->type === 'audio', 422, 'An audio file cannot start a post.');
        }

        $text = $data['body'] ?? $data['caption'] ?? null;
        $fromAgent = blank($text) && $run !== null;
        $body = $fromAgent ? (string) $run->output : (string) ($text ?? '');

        $type = $data['type'] ?? ($media?->type === 'video' ? 'reel' : 'post');
        $platform = $data['platform'] ?? 'instagram';
        $title = $data['title'] ?? (filled($body)
            ? Str::limit(trim((string) preg_replace('/\s+/u', ' ', $body)), 60)
            : 'AI ' . ($media?->type ?? 'post'));
        $language = $data['language'] ?? (filled($body) ? ContentService::detectLanguage($body) : 'ar');

        $item = DB::transaction(function () use ($data, $client, $user, $run, $media, $body, $fromAgent, $type, $platform, $title, $language) {
            $item = ContentItem::forceCreate([
                'company_id' => $client->company_id,
                'client_id' => $client->id,
                'campaign_id' => $data['campaign_id'] ?? null,
                'task_id' => $data['task_id'] ?? null,
                'type' => $type,
                'platform' => $platform,
                'title' => $title,
                'status' => 'draft',
                'created_by_type' => 'user',
                'created_by_id' => $user->id,
                'source_run_id' => $run?->id,
                'is_example' => false,
            ]);

            $version = ContentService::createVersion($item, [
                'body' => $body,
                'language' => $language,
                'hashtags' => $data['hashtags'] ?? [],
                'script' => $data['script'] ?? null,
                'instruction' => null,
            ], $fromAgent ? 'agent' : 'user', $fromAgent ? null : $user->id, $run?->id);

            $item->forceFill(['current_version_id' => $version->id])->save();

            if ($media) {
                $item->mediaAssets()->syncWithoutDetaching([$media->id => ['position' => 0]]);
            }

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
     * A content with status revision_requested can be sent again directly: it goes back to draft and is sent.
     */
    public function submit(Request $request, int $id): JsonResponse
    {
        $item = ContentItem::findOrFail($id);
        abort_unless(
            in_array($item->status, ['draft', 'revision_requested'], true) && $item->current_version_id,
            422,
            'Only a draft (or content with requested changes) that has a version can be submitted.'
        );

        $data = $request->validate(['requested_from_id' => ['nullable', 'integer']]);

        $internal = ! $request->user()->hasPermission('approvals.manage');

        $approval = DB::transaction(function () use ($item, $internal, $request, $data) {
            if ($item->status === 'revision_requested') {
                $item->forceFill(['status' => 'draft'])->save();
            }

            return $internal
                ? ContentService::requestInternalReview($item, $request->user()->id)
                : ContentService::requestClientApproval($item, $data['requested_from_id'] ?? null, $request->user()->id);
        });

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

        StuckWork::sweepThrottled();
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
