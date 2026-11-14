<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Client;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ClientController extends Controller
{
    // The company scope on Client already limits everything here to the user's own company.

    /** Optional filters: ?status=active&q=cafe */
    public function index(Request $request): JsonResponse
    {
        $query = Client::query()->orderBy('name');

        if ($request->filled('status')) {
            $query->where('status', $request->query('status'));
        }
        if ($request->filled('q')) {
            $query->where('name', 'like', '%' . $request->query('q') . '%');
        }

        return response()->json($query->get());
    }

    public function show(int $id): JsonResponse
    {
        return response()->json(Client::with('brandIdentity')->findOrFail($id));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate($this->rules($request, creating: true));

        $client = Client::create($data + [
            'agreed_services' => $data['agreed_services'] ?? [],
            'status' => $data['status'] ?? 'active',
        ]);

        return response()->json($client, 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $client = Client::findOrFail($id);
        $client->update($request->validate($this->rules($request, creating: false)));

        return response()->json($client->fresh());
    }

    /** Soft delete: the client can be restored from the database, its AI memory is kept. */
    public function destroy(int $id): JsonResponse
    {
        Client::findOrFail($id)->delete();

        return response()->json(['message' => 'Client deleted.']);
    }

    private function rules(Request $request, bool $creating): array
    {
        $required = $creating ? 'required' : 'sometimes';
        $companyId = $request->user()->company_id;

        return [
            'name' => [$required, 'string', 'max:255'],
            'industry' => ['nullable', 'string', 'max:255'],
            'contact_name' => ['nullable', 'string', 'max:255'],
            'contact_email' => ['nullable', 'email', 'max:255'],
            'contact_phone' => ['nullable', 'string', 'max:50'],
            'goals' => ['nullable', 'string'],
            'agreed_services' => ['nullable', 'array'],
            'status' => ['sometimes', Rule::in(['active', 'paused', 'churned'])],
            // the responsible employee must belong to the same company
            'responsible_user_id' => ['nullable', 'integer', Rule::exists('users', 'id')->where('company_id', $companyId)],
        ];
    }
}
