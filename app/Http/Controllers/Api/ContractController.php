<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Client;
use App\Models\Contract;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Contracts, services and renewals of the clients. Read: clients.view. Change: clients.update.
 * The amount is shown only to people who can change clients (Owner, Manager).
 * Status is computed: cancelled (set by hand), expired (ended), expiring (the end or renewal date is within
 * 30 days), otherwise active.
 */
class ContractController extends Controller
{
    private const SOON_DAYS = 30;

    /** Filters: client_id, status (active|expiring|expired|cancelled). Ordered by the nearest end date. */
    public function index(Request $request): JsonResponse
    {
        $query = Contract::with('client:id,name')->orderByRaw('ends_on is null, ends_on')->orderBy('id');
        if ($request->filled('client_id')) {
            $query->where('client_id', $request->query('client_id'));
        }

        $items = $query->limit(500)->get()->map(fn ($c) => $this->present($request, $c));
        if ($request->filled('status')) {
            $items = $items->where('status', $request->query('status'));
        }

        return response()->json($items->values());
    }

    public function show(Request $request, int $id): JsonResponse
    {
        return response()->json($this->present($request, Contract::with('client:id,name')->findOrFail($id)));
    }

    /** Body: client_id, service, starts_on, ends_on, renewal_date, amount (all dates YYYY-MM-DD). */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate($this->rules($request));
        $client = Client::findOrFail($data['client_id']);

        $contract = Contract::forceCreate([
            'company_id' => $client->company_id,
            'client_id' => $client->id,
            'service' => $data['service'],
            'starts_on' => $data['starts_on'],
            'ends_on' => $data['ends_on'] ?? null,
            'renewal_date' => $data['renewal_date'] ?? null,
            'amount' => $data['amount'] ?? null,
            'status' => 'active',
        ]);

        return response()->json($this->present($request, $contract->load('client:id,name')), 201);
    }

    /** Send only what changes: service, starts_on, ends_on, renewal_date, amount. */
    public function update(Request $request, int $id): JsonResponse
    {
        $contract = Contract::findOrFail($id);
        abort_if($contract->status === 'cancelled', 422, 'A cancelled contract cannot be changed.');

        $rules = collect($this->rules($request, partial: true))->except('client_id')->all();
        $contract->forceFill($request->validate($rules))->save();

        return response()->json($this->present($request, $contract->fresh()->load('client:id,name')));
    }

    public function cancel(Request $request, int $id): JsonResponse
    {
        $contract = Contract::findOrFail($id);
        abort_if($contract->status === 'cancelled', 422, 'This contract was already cancelled.');
        $contract->forceFill(['status' => 'cancelled'])->save();

        return response()->json($this->present($request, $contract->fresh()->load('client:id,name')));
    }

    public function destroy(int $id): JsonResponse
    {
        Contract::findOrFail($id)->delete();

        return response()->json(['deleted' => true]);
    }

    // ------------------------------------------------------------ helpers

    private function rules(Request $request, bool $partial = false): array
    {
        $companyId = $request->user()->company_id;
        $req = $partial ? 'sometimes' : 'required';

        return [
            'client_id' => ['required', 'integer', Rule::exists('clients', 'id')->where('company_id', $companyId)],
            'service' => [$req, 'string', 'max:255'],
            'starts_on' => [$req, 'date'],
            'ends_on' => ['nullable', 'date', 'after_or_equal:starts_on'],
            'renewal_date' => ['nullable', 'date'],
            'amount' => ['nullable', 'numeric', 'min:0', 'max:9999999999'],
        ];
    }

    private function present(Request $request, Contract $c): array
    {
        $row = $c->toArray();
        $row['status'] = $this->status($c);
        $row['days_left'] = $c->ends_on ? (int) now()->startOfDay()->diffInDays($c->ends_on, false) : null;
        if (! $request->user()->hasPermission('clients.update')) {
            $row['amount'] = null;
        }

        return $row;
    }

    private function status(Contract $c): string
    {
        if ($c->status === 'cancelled') {
            return 'cancelled';
        }
        $today = now()->startOfDay();
        if ($c->ends_on && $c->ends_on->lt($today)) {
            return 'expired';
        }
        $soon = $today->copy()->addDays(self::SOON_DAYS);
        foreach ([$c->ends_on, $c->renewal_date] as $date) {
            if ($date && $date->betweenIncluded($today, $soon)) {
                return 'expiring';
            }
        }

        return 'active';
    }
}
