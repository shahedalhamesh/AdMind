<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Client;
use App\Models\Company;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/** The Platform Admin (the owner of AdMind itself) manages the agencies that use it. */
class AdminCompanyController extends Controller
{
    /** Filters: status (trial|active|suspended|cancelled), q (name contains), per_page (max 100). */
    public function index(Request $request): JsonResponse
    {
        $this->authorizeAdmin($request);

        $query = Company::query()->orderByDesc('id');
        if ($request->filled('status')) {
            $query->where('subscription_status', $request->query('status'));
        }
        if ($request->filled('q')) {
            $query->where('name', 'like', '%' . $request->query('q') . '%');
        }

        $page = $query->paginate(min((int) $request->query('per_page', 20), 100));
        $ids = $page->pluck('id');
        $users = User::whereIn('company_id', $ids)->whereNull('client_id')->selectRaw('company_id, count(*) n')->groupBy('company_id')->pluck('n', 'company_id');
        $clients = Client::whereIn('company_id', $ids)->selectRaw('company_id, count(*) n')->groupBy('company_id')->pluck('n', 'company_id');

        $page->getCollection()->transform(fn (Company $c) => $c->only([
            'id', 'name', 'plan', 'subscription_status', 'subscription_ends_at', 'created_at',
        ]) + ['staff_count' => (int) ($users[$c->id] ?? 0), 'clients_count' => (int) ($clients[$c->id] ?? 0)]);

        return response()->json($page);
    }

    /**
     * Change a company's subscription. Body: subscription_status (trial|active|suspended|cancelled).
     * Suspending or cancelling signs everybody of that company out at once.
     */
    public function update(Request $request, int $id): JsonResponse
    {
        $this->authorizeAdmin($request);
        $company = Company::findOrFail($id);

        $data = $request->validate([
            'subscription_status' => ['required', Rule::in(['trial', 'active', 'suspended', 'cancelled'])],
        ]);
        $company->forceFill(['subscription_status' => $data['subscription_status']])->save();

        if (in_array($data['subscription_status'], ['suspended', 'cancelled'], true)) {
            foreach (User::where('company_id', $company->id)->get() as $user) {
                $user->tokens()->delete();
            }
        }

        return response()->json($company->only(['id', 'name', 'plan', 'subscription_status']));
    }

    private function authorizeAdmin(Request $request): void
    {
        abort_unless($request->user()->isPlatformAdmin(), 403, 'Only the platform admin can do this.');
    }
}
