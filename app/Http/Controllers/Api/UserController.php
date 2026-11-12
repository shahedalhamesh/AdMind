<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Role;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Staff and client logins of one company. Users are never deleted (they own conversations and
 * approvals): set status to "disabled" instead, which also signs them out.
 */
class UserController extends Controller
{
    /** Filters: role_id, status, client_id, q (name or email). */
    public function index(Request $request): JsonResponse
    {
        $query = User::where('company_id', $this->companyId($request))
            ->with(['role:id,name', 'client:id,name'])
            ->orderBy('name');

        foreach (['role_id', 'status', 'client_id'] as $filter) {
            if ($request->filled($filter)) {
                $query->where($filter, $request->query($filter));
            }
        }
        if ($request->filled('q')) {
            $term = '%' . $request->query('q') . '%';
            $query->where(fn ($q) => $q->where('name', 'like', $term)->orWhere('email', 'like', $term));
        }

        return response()->json($query->get());
    }

    public function show(Request $request, int $id): JsonResponse
    {
        return response()->json($this->find($request, $id));
    }

    public function store(Request $request): JsonResponse
    {
        $companyId = $this->companyId($request);

        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', Rule::unique('users', 'email')],
            'password' => ['required', 'string', 'min:8'],
            'role_id' => ['required', 'integer', Rule::exists('roles', 'id')->where('company_id', $companyId)],
            'client_id' => ['nullable', 'integer', Rule::exists('clients', 'id')->where('company_id', $companyId)->whereNull('deleted_at')],
            'status' => ['sometimes', Rule::in(['active', 'disabled'])],
        ]);

        $this->checkClientLink((int) $data['role_id'], $data['client_id'] ?? null);

        $user = User::forceCreate([
            'company_id' => $companyId,
            'role_id' => $data['role_id'],
            'client_id' => $data['client_id'] ?? null,
            'name' => $data['name'],
            'email' => $data['email'],
            'password' => $data['password'], // hashed by the model
            'status' => $data['status'] ?? 'active',
        ]);

        return response()->json($user->load(['role:id,name', 'client:id,name']), 201);
    }

    /** Send only what changes. `password` (min 8) resets the password and signs the user out. */
    public function update(Request $request, int $id): JsonResponse
    {
        $companyId = $this->companyId($request);
        $user = $this->find($request, $id);

        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'email' => ['sometimes', 'email', 'max:255', Rule::unique('users', 'email')->ignore($user->id)],
            'password' => ['sometimes', 'string', 'min:8'],
            'role_id' => ['sometimes', 'integer', Rule::exists('roles', 'id')->where('company_id', $companyId)],
            'client_id' => ['sometimes', 'nullable', 'integer', Rule::exists('clients', 'id')->where('company_id', $companyId)->whereNull('deleted_at')],
            'status' => ['sometimes', Rule::in(['active', 'disabled'])],
        ]);

        $newRoleId = (int) ($data['role_id'] ?? $user->role_id);
        $newClientId = array_key_exists('client_id', $data) ? $data['client_id'] : $user->client_id;
        $newClientId = $newClientId !== null ? (int) $newClientId : null;
        $newStatus = $data['status'] ?? $user->status;

        $this->checkClientLink($newRoleId, $newClientId);

        $changesAccess = $newRoleId !== (int) $user->role_id
            || $newClientId !== $user->client_id
            || $newStatus !== $user->status;

        if ($user->id === $request->user()->id && $changesAccess) {
            abort(422, 'You cannot change your own role, client link or status.');
        }

        // The company must always keep at least one active Owner
        $losesOwner = $user->role?->name === 'Owner' && $user->status === 'active'
            && ($newStatus !== 'active' || $newRoleId !== (int) $user->role_id);
        if ($losesOwner) {
            $otherOwners = User::where('company_id', $companyId)->where('status', 'active')
                ->where('id', '!=', $user->id)
                ->whereHas('role', fn ($q) => $q->where('name', 'Owner'))->count();
            abort_if($otherOwners === 0, 422, 'The company needs at least one active Owner.');
        }

        $user->forceFill(array_merge(
            collect($data)->only(['name', 'email', 'password'])->all(),
            ['role_id' => $newRoleId, 'client_id' => $newClientId, 'status' => $newStatus]
        ))->save();

        // Disabled or password reset: all existing tokens stop working
        if ($newStatus === 'disabled' || isset($data['password'])) {
            $user->tokens()->delete();
        }

        return response()->json($user->fresh(['role:id,name', 'client:id,name']));
    }

    /** The roles of the company (for the role dropdown), with their permissions. */
    public function roles(Request $request): JsonResponse
    {
        return response()->json(
            Role::where('company_id', $this->companyId($request))->orderBy('id')->get(['id', 'name', 'permissions'])
        );
    }

    /** Any logged-in user changes their own password. Other devices are signed out. */
    public function changePassword(Request $request): JsonResponse
    {
        $data = $request->validate([
            'current_password' => ['required', 'string'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ]);

        $user = $request->user();
        if (! Hash::check($data['current_password'], $user->password)) {
            throw ValidationException::withMessages(['current_password' => 'The current password is wrong.']);
        }

        $user->forceFill(['password' => $data['password']])->save();
        $user->tokens()->where('id', '!=', $user->currentAccessToken()->id)->delete();

        return response()->json(['message' => 'Password changed.']);
    }

    // ---------------------------------------------------------------- helpers

    /** A platform admin has no company: they must say which one with company_id. */
    private function companyId(Request $request): int
    {
        $companyId = $request->user()->company_id ?? $request->integer('company_id');
        abort_unless($companyId, 422, 'company_id is required for a platform admin.');

        return (int) $companyId;
    }

    private function find(Request $request, int $id): User
    {
        return User::where('company_id', $this->companyId($request))
            ->with(['role:id,name', 'client:id,name'])->findOrFail($id);
    }

    /** A login linked to a client must have the Client role, and the Client role needs a client. */
    private function checkClientLink(int $roleId, ?int $clientId): void
    {
        $isClientRole = Role::whereKey($roleId)->value('name') === 'Client';

        if ($isClientRole && ! $clientId) {
            throw ValidationException::withMessages(['client_id' => 'A user with the Client role must be linked to a client.']);
        }
        if (! $isClientRole && $clientId) {
            throw ValidationException::withMessages(['client_id' => 'Only a user with the Client role can be linked to a client.']);
        }
    }
}
