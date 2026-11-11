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

            $version = $this->createVersion($item, [
                'body' => $body,
                'language' => $data['language'] ?? $this->detectLanguage($body),
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
            $version = $this->createVersion($item, [
                'body' => $data['body'],
                'language' => $data['language'] ?? $this->detectLanguage($data['body']),
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
     * Send a draft for approval. `requested_from_id` is optional: by default the request goes
     * to the client's own login (a user linked to this client), else to the client's responsible employee.
     */
    public function submit(Request $request, int $id): JsonResponse
    {
        $item = ContentItem::with('client')->findOrFail($id);
        abort_unless($item->status === 'draft' && $item->current_version_id, 422, 'Only a draft with a version can be submitted.');

        $data = $request->validate(['requested_from_id' => ['nullable', 'integer']]);

        $approverId = $data['requested_from_id'] ?? User::where('company_id', $item->company_id)
            ->where('client_id', $item->client_id)->where('status', 'active')->value('id')
            ?? $item->client?->responsible_user_id;
        abort_unless($approverId, 422, 'No approver found. Send requested_from_id.');

        $approver = User::where('company_id', $item->company_id)->where('status', 'active')->findOrFail($approverId);

        $approval = DB::transaction(function () use ($item, $approver) {
            $approval = Approval::forceCreate([
                'company_id' => $item->company_id,
                'subject_type' => 'content_item',
                'subject_id' => $item->id,
                'requested_from_type' => $approver->client_id ? 'client' : 'user',
                'requested_from_id' => $approver->id,
                'reason' => 'policy',
                'status' => 'pending',
            ]);
            $item->forceFill(['status' => 'in_review'])->save();

            return $approval;
        });

        return response()->json(['content_status' => $item->status, 'approval' => $approval], 201);
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

    private function createVersion(ContentItem $item, array $fields, string $byType, ?int $byId, ?int $runId): ContentVersion
    {
        return ContentVersion::forceCreate([
            'company_id' => $item->company_id,
            'content_id' => $item->id,
            'version_number' => ((int) ContentVersion::where('content_id', $item->id)->max('version_number')) + 1,
            'language' => $fields['language'],
            'body' => $fields['body'],
            'hashtags' => $fields['hashtags'],
            'script' => $fields['script'],
            'instruction' => $fields['instruction'],
            'created_by_type' => $byType,
            'created_by_id' => $byId,
            'agent_run_id' => $runId,
        ]);
    }

    private function detectLanguage(string $text): string
    {
        $arabic = preg_match_all('/\p{Arabic}/u', $text);
        $latin = preg_match_all('/[A-Za-z]/', $text);

        return $arabic >= $latin ? 'ar' : 'en';
    }
}
