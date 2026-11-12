<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Concerns\ResolvesCompany;
use App\Http\Controllers\Controller;
use App\Models\Campaign;
use App\Models\Client;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class CampaignController extends Controller
{
    use ResolvesCompany;

    private const STATUSES = ['draft', 'planned', 'active', 'paused', 'completed'];
    private const PLATFORMS = ['instagram', 'facebook', 'tiktok', 'x', 'linkedin', 'snapchat'];

    /** Filters: client_id, status, per_page (max 100). */
    public function index(Request $request): JsonResponse
    {
        $query = Campaign::with('client:id,name')->withCount('contentItems')->orderByDesc('id');

        foreach (['client_id', 'status'] as $filter) {
            if ($request->filled($filter)) {
                $query->where($filter, $request->query($filter));
            }
        }

        return response()->json($query->paginate(min((int) $request->query('per_page', 20), 100)));
    }

    public function show(int $id): JsonResponse
    {
        $campaign = Campaign::with('client:id,name')->findOrFail($id);

        return response()->json([
            'campaign' => $campaign,
            'remaining' => round((float) $campaign->budget - (float) $campaign->spent, 2),
            'over_budget' => (float) $campaign->spent > (float) $campaign->budget,
            'content' => $campaign->contentItems()->orderByDesc('id')->get(['id', 'title', 'type', 'platform', 'status']),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $companyId = $this->companyId($request);

        $data = $request->validate([
            'client_id' => ['required', 'integer'],
            'name' => ['required', 'string', 'max:255'],
            'objective' => ['required', 'string', 'max:255'],
            'budget' => ['required', 'numeric', 'min:0'],
            'currency' => ['nullable', 'string', 'size:3'],
            'channels' => ['required', 'array', 'min:1'],
            'channels.*' => [Rule::in(self::PLATFORMS)],
            'audience' => ['nullable', 'array'],
            'starts_on' => ['nullable', 'date'],
            'ends_on' => ['nullable', 'date'],
            'status' => ['nullable', Rule::in(self::STATUSES)],
            'plan' => ['nullable', 'array'],
        ]);

        if (! empty($data['starts_on']) && ! empty($data['ends_on']) && strtotime($data['ends_on']) < strtotime($data['starts_on'])) {
            throw ValidationException::withMessages(['ends_on' => 'The end date cannot be before the start date.']);
        }

        Client::where('company_id', $companyId)->findOrFail($data['client_id']);

        $campaign = Campaign::forceCreate([
            'company_id' => $companyId,
            'client_id' => $data['client_id'],
            'name' => $data['name'],
            'objective' => $data['objective'],
            'budget' => $data['budget'],
            'spent' => 0,
            'currency' => strtoupper($data['currency'] ?? 'SAR'),
            'channels' => $data['channels'],
            'audience' => $data['audience'] ?? null,
            'starts_on' => $data['starts_on'] ?? null,
            'ends_on' => $data['ends_on'] ?? null,
            'status' => $data['status'] ?? 'draft',
            'plan' => $data['plan'] ?? [],
        ]);

        return response()->json($campaign->load('client:id,name'), 201);
    }

    /** Send only what changes. `spent` is updated by hand until ad accounts are connected. */
    public function update(Request $request, int $id): JsonResponse
    {
        $campaign = Campaign::findOrFail($id);

        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'objective' => ['sometimes', 'string', 'max:255'],
            'budget' => ['sometimes', 'numeric', 'min:0'],
            'spent' => ['sometimes', 'numeric', 'min:0'],
            'currency' => ['sometimes', 'string', 'size:3'],
            'channels' => ['sometimes', 'array', 'min:1'],
            'channels.*' => [Rule::in(self::PLATFORMS)],
            'audience' => ['sometimes', 'nullable', 'array'],
            'starts_on' => ['sometimes', 'nullable', 'date'],
            'ends_on' => ['sometimes', 'nullable', 'date'],
            'status' => ['sometimes', Rule::in(self::STATUSES)],
            'plan' => ['sometimes', 'array'],
        ]);

        $starts = array_key_exists('starts_on', $data) ? $data['starts_on'] : $campaign->starts_on;
        $ends = array_key_exists('ends_on', $data) ? $data['ends_on'] : $campaign->ends_on;
        if ($starts && $ends && strtotime((string) $ends) < strtotime((string) $starts)) {
            throw ValidationException::withMessages(['ends_on' => 'The end date cannot be before the start date.']);
        }

        if (isset($data['currency'])) {
            $data['currency'] = strtoupper($data['currency']);
        }

        $campaign->update($data);

        return response()->json($campaign->fresh('client:id,name'));
    }

    /** Only a draft can be deleted: mark the others "completed". Its content stays (without a campaign). */
    public function destroy(int $id): JsonResponse
    {
        $campaign = Campaign::findOrFail($id);
        abort_unless($campaign->status === 'draft', 422, 'Only a draft campaign can be deleted. Mark it as completed instead.');
        $campaign->delete();

        return response()->json(['message' => 'Campaign deleted.']);
    }
}
