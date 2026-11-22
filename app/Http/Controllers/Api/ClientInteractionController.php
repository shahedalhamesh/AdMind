<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Client;
use App\Models\ClientInteraction;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** The history of what happened with a client: meetings, messages, calls, notes. Read: clients.view. Write: clients.update. */
class ClientInteractionController extends Controller
{
    /** Filters: type (meeting|message|call|note), from, to (dates), per_page (max 100). Newest first. */
    public function index(Request $request, int $clientId): JsonResponse
    {
        Client::findOrFail($clientId);
        $query = ClientInteraction::where('client_id', $clientId)->orderByDesc('occurred_at')->orderByDesc('id');

        if ($request->filled('type')) {
            $query->where('type', $request->query('type'));
        }
        if ($request->filled('from')) {
            $query->where('occurred_at', '>=', $request->query('from'));
        }
        if ($request->filled('to')) {
            $query->where('occurred_at', '<=', $request->query('to').' 23:59:59');
        }

        return response()->json($query->paginate(min((int) $request->query('per_page', 30), 100)));
    }

    /** Body: type, summary, occurred_at (default now, not in the future), source (optional: where it came from). */
    public function store(Request $request, int $clientId): JsonResponse
    {
        $client = Client::findOrFail($clientId);
        $data = $request->validate([
            'type' => ['required', 'in:meeting,message,call,note'],
            'summary' => ['required', 'string', 'max:5000'],
            'occurred_at' => ['nullable', 'date', 'before_or_equal:now'],
            'source' => ['nullable', 'string', 'max:100'],
        ]);

        $item = ClientInteraction::forceCreate([
            'company_id' => $client->company_id,
            'client_id' => $client->id,
            'type' => $data['type'],
            'summary' => $data['summary'],
            'source' => $data['source'] ?? 'manual',
            'occurred_at' => $data['occurred_at'] ?? now(),
        ]);

        return response()->json($item, 201);
    }

    /** Send only what changes: type, summary, occurred_at, source. */
    public function update(Request $request, int $id): JsonResponse
    {
        $item = ClientInteraction::findOrFail($id);
        $data = $request->validate([
            'type' => ['sometimes', 'in:meeting,message,call,note'],
            'summary' => ['sometimes', 'string', 'max:5000'],
            'occurred_at' => ['sometimes', 'date', 'before_or_equal:now'],
            'source' => ['sometimes', 'nullable', 'string', 'max:100'],
        ]);
        $item->forceFill($data)->save();

        return response()->json($item->fresh());
    }

    public function destroy(int $id): JsonResponse
    {
        ClientInteraction::findOrFail($id)->delete();

        return response()->json(['deleted' => true]);
    }
}
