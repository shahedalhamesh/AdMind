<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AiPolicy;
use App\Models\Client;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * How much the AI may do by itself. One company default (client_id null) and optional overrides per client.
 * Read: clients.view. Change: clients.update (Owner, Manager).
 * Levels: manual (the AI only drafts), assisted (default: every step is approved by people), autonomous.
 * approval_rules and publish_rules are free JSON saved for the AI and the frontend, for example
 * {"require_internal_review": true} and {"auto_publish": false, "allowed_platforms": ["instagram"]}.
 */
class AiPolicyController extends Controller
{
    private const BUILT_IN = ['autonomy_level' => 'assisted', 'max_spend' => null, 'approval_rules' => [], 'publish_rules' => [], 'escalate_to_user_id' => null];

    /** The company default and the per-client overrides. */
    public function index(Request $request): JsonResponse
    {
        $all = AiPolicy::where('company_id', $request->user()->company_id)->with('client:id,name')->get();

        return response()->json([
            'default' => $all->first(fn ($p) => $p->client_id === null),
            'clients' => $all->filter(fn ($p) => $p->client_id !== null)->values(),
        ]);
    }

    /** The policy that applies to a client: its own, else the company default, else the built-in one. Query: client_id. */
    public function effective(Request $request): JsonResponse
    {
        $companyId = $request->user()->company_id;
        $data = $request->validate(['client_id' => ['required', 'integer', Rule::exists('clients', 'id')->where('company_id', $companyId)]]);

        $own = AiPolicy::where('company_id', $companyId)->where('client_id', $data['client_id'])->first();
        if ($own) {
            return response()->json($own->toArray() + ['source' => 'client']);
        }
        $default = AiPolicy::where('company_id', $companyId)->whereNull('client_id')->first();
        if ($default) {
            return response()->json($default->toArray() + ['source' => 'company']);
        }

        return response()->json(self::BUILT_IN + ['client_id' => (int) $data['client_id'], 'source' => 'builtin']);
    }

    /** Create or change a policy. Body: client_id (null or missing = the company default) + the fields. */
    public function save(Request $request): JsonResponse
    {
        $companyId = $request->user()->company_id;
        $data = $request->validate([
            'client_id' => ['nullable', 'integer', Rule::exists('clients', 'id')->where('company_id', $companyId)],
            'autonomy_level' => ['required', 'in:manual,assisted,autonomous'],
            'max_spend' => ['nullable', 'numeric', 'min:0', 'max:9999999999'],
            'approval_rules' => ['nullable', 'array'],
            'publish_rules' => ['nullable', 'array'],
            'escalate_to_user_id' => ['nullable', 'integer', Rule::exists('users', 'id')->where('company_id', $companyId)->whereNull('client_id')],
        ]);

        $clientId = $data['client_id'] ?? null;
        $query = AiPolicy::where('company_id', $companyId);
        $clientId === null ? $query->whereNull('client_id') : $query->where('client_id', $clientId);
        $policy = $query->first() ?? new AiPolicy();

        $policy->forceFill([
            'company_id' => $companyId,
            'client_id' => $clientId,
            'autonomy_level' => $data['autonomy_level'],
            'max_spend' => $data['max_spend'] ?? null,
            'approval_rules' => $data['approval_rules'] ?? ($policy->approval_rules ?? []),
            'publish_rules' => $data['publish_rules'] ?? ($policy->publish_rules ?? []),
            'escalate_to_user_id' => $data['escalate_to_user_id'] ?? null,
        ])->save();

        return response()->json($policy->fresh()->load('client:id,name'), $policy->wasRecentlyCreated ? 201 : 200);
    }

    /** Remove a client's override (it goes back to the company default). The default itself cannot be deleted. */
    public function destroy(Request $request, int $id): JsonResponse
    {
        $policy = AiPolicy::where('company_id', $request->user()->company_id)->findOrFail($id);
        abort_if($policy->client_id === null, 422, 'The company default cannot be deleted. Change it instead.');
        $policy->delete();

        return response()->json(['deleted' => true]);
    }
}
