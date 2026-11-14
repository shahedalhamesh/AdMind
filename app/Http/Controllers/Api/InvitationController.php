<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Client;
use App\Models\Company;
use App\Models\Invitation;
use App\Models\Role;
use App\Models\User;
use App\Services\ContentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

/**
 * Invitation links: the Owner invites a person by email with a role. The person opens the link,
 * signs in with Google (the Google email must be the invited email) or chooses a password, and the
 * account is created. The link works once, expires (default 7 days) and can be revoked.
 *
 * There is no email sending yet: the Owner copies the link and sends it (WhatsApp, email...).
 */
class InvitationController extends Controller
{
    // ------------------------------------------------------- for the team

    /** Filters: status (pending|accepted|revoked|expired). */
    public function index(Request $request): JsonResponse
    {
        $companyId = $this->companyId($request);
        $items = Invitation::where('company_id', $companyId)->with(['role:id,name', 'client:id,name'])
            ->orderByDesc('id')->get();

        if ($request->filled('status')) {
            $items = $items->where('status', $request->query('status'))->values();
        }

        return response()->json($items);
    }

    /** Body: email, role_id, client_id (only for the Client role), expires_in_days (1 to 30, default 7). */
    public function store(Request $request): JsonResponse
    {
        $companyId = $this->companyId($request);
        $data = $request->validate([
            'email' => ['required', 'email:rfc', 'max:255'],
            'role_id' => ['required', 'integer', Rule::exists('roles', 'id')->where('company_id', $companyId)],
            'client_id' => ['nullable', 'integer', Rule::exists('clients', 'id')->where('company_id', $companyId)->whereNull('deleted_at')],
            'expires_in_days' => ['nullable', 'integer', 'min:1', 'max:30'],
        ]);
        $email = mb_strtolower($data['email']);
        abort_if(User::where('email', $email)->exists(), 422, 'A user with this email already exists.');
        $this->checkClientLink((int) $data['role_id'], $data['client_id'] ?? null);

        // a new invitation replaces the earlier open ones for the same email
        Invitation::where('company_id', $companyId)->where('email', $email)
            ->whereNull('accepted_at')->whereNull('revoked_at')->update(['revoked_at' => now()]);

        $token = Str::random(48);
        $invitation = Invitation::forceCreate([
            'company_id' => $companyId,
            'email' => $email,
            'role_id' => $data['role_id'],
            'client_id' => $data['client_id'] ?? null,
            'invited_by_user_id' => $request->user()->id,
            'token_hash' => Invitation::hashToken($token),
            'expires_at' => now()->addDays($data['expires_in_days'] ?? 7),
        ]);

        return response()->json($this->withToken($invitation, $token), 201);
    }

    /** A new link (the old one stops working) and a fresh expiry. Only for a pending or expired invitation. */
    public function renew(Request $request, int $id): JsonResponse
    {
        $invitation = Invitation::where('company_id', $this->companyId($request))->findOrFail($id);
        abort_unless(in_array($invitation->status, ['pending', 'expired'], true), 422, 'This invitation can no longer be renewed.');
        abort_if(User::where('email', $invitation->email)->exists(), 422, 'A user with this email already exists.');

        $token = Str::random(48);
        $invitation->forceFill([
            'token_hash' => Invitation::hashToken($token),
            'expires_at' => now()->addDays(7),
        ])->save();

        return response()->json($this->withToken($invitation->fresh(), $token));
    }

    public function revoke(Request $request, int $id): JsonResponse
    {
        $invitation = Invitation::where('company_id', $this->companyId($request))->findOrFail($id);
        abort_unless($invitation->status === 'pending', 422, 'Only a pending invitation can be revoked.');
        $invitation->forceFill(['revoked_at' => now()])->save();

        return response()->json($invitation->fresh());
    }

    // ------------------------------------------------ for the invited person (public)

    /** Show who invites, which role and which email, so the join page can greet the person. */
    public function preview(string $token): JsonResponse
    {
        $invitation = $this->findValid($token);

        return response()->json([
            'company_name' => Company::whereKey($invitation->company_id)->value('name'),
            'email' => $invitation->email,
            'role' => Role::whereKey($invitation->role_id)->value('name'),
            'client_name' => $invitation->client_id ? Client::withoutGlobalScopes()->whereKey($invitation->client_id)->value('name') : null,
            'expires_at' => $invitation->expires_at,
        ]);
    }

    /**
     * Accept. Body: either `credential` (Google ID token; its verified email must be the invited email)
     * or `name` + `password` (min 8). Optional: name (with Google), device_name.
     * Returns 201 with the same payload as login: the new user is signed in.
     */
    public function accept(Request $request, string $token): JsonResponse
    {
        $invitation = $this->findValid($token);

        $data = $request->validate([
            'credential' => ['nullable', 'string'],
            'name' => ['nullable', 'string', 'max:255'],
            'password' => ['nullable', 'string', 'min:8', 'max:100'],
            'device_name' => ['nullable', 'string', 'max:100'],
        ]);

        if (! empty($data['credential'])) {
            $info = $this->verifyGoogle($data['credential']);
            if ($info === null) {
                return response()->json(['message' => 'Invalid Google token.'], 422);
            }
            if (mb_strtolower($info['email']) !== $invitation->email) {
                return response()->json(['message' => 'This Google account does not match the invited email.'], 403);
            }
            $name = trim($data['name'] ?? '') ?: ($info['name'] ?? Str::before($invitation->email, '@'));
            $password = Str::random(40); // never used: this person signs in with Google (the Owner can set a password later)
        } else {
            $request->validate(['name' => ['required'], 'password' => ['required']]);
            $name = $data['name'];
            $password = $data['password'];
        }

        $status = Company::whereKey($invitation->company_id)->value('subscription_status');
        abort_if(in_array($status, ['suspended', 'cancelled'], true), 403, 'This company subscription is not active. Contact support.');

        $user = DB::transaction(function () use ($invitation, $name, $password) {
            $fresh = Invitation::withoutGlobalScopes()->lockForUpdate()->findOrFail($invitation->id);
            abort_unless($fresh->status === 'pending', 404, 'This invitation is not valid.');
            abort_if(User::where('email', $fresh->email)->exists(), 422, 'A user with this email already exists.');

            $user = User::forceCreate([
                'company_id' => $fresh->company_id,
                'role_id' => $fresh->role_id,
                'client_id' => $fresh->client_id,
                'name' => $name,
                'email' => $fresh->email,
                'password' => $password,
                'status' => 'active',
                'last_login_at' => now(),
            ]);
            $fresh->forceFill(['accepted_at' => now(), 'accepted_user_id' => $user->id])->save();

            return $user;
        });

        if ($invitation->invited_by_user_id) {
            ContentService::notify($invitation->company_id, [$invitation->invited_by_user_id], 'member_joined',
                "{$user->name} joined the team", Role::whereKey($invitation->role_id)->value('name'),
                ['user_id' => $user->id]);
        }

        return response()->json([
            'token' => $user->createToken($data['device_name'] ?? 'invite')->plainTextToken,
            'user' => $this->userPayload($user),
        ], 201);
    }

    // ------------------------------------------------------------ helpers

    private function findValid(string $token): Invitation
    {
        $invitation = Invitation::withoutGlobalScopes()->where('token_hash', Invitation::hashToken($token))->first();
        abort_unless($invitation && $invitation->status === 'pending', 404, 'This invitation is not valid.');

        return $invitation;
    }

    /** The token is shown only once, here, in the response that creates or renews the link. */
    private function withToken(Invitation $invitation, string $token): array
    {
        return $invitation->load(['role:id,name', 'client:id,name'])->toArray() + ['token' => $token];
    }

    private function companyId(Request $request): int
    {
        $id = $request->user()->company_id;
        abort_if($id === null, 403, 'Use an agency account to manage invitations.');

        return $id;
    }

    /** Same rule as creating a user: the Client role needs a client; other roles must not have one. */
    private function checkClientLink(int $roleId, $clientId): void
    {
        $isClientRole = Role::whereKey($roleId)->value('name') === 'Client';
        if ($isClientRole && ! $clientId) {
            abort(422, 'A user with the Client role must belong to a client (client_id).');
        }
        if (! $isClientRole && $clientId) {
            abort(422, 'client_id is only allowed for the Client role.');
        }
    }

    /** Returns the Google token info when it is valid for this app and the email is verified. */
    private function verifyGoogle(string $credential): ?array
    {
        $clientId = config('services.google.client_id');
        abort_unless($clientId, 503, 'Google sign-in is not configured.');

        $response = Http::timeout(10)->get('https://oauth2.googleapis.com/tokeninfo', ['id_token' => $credential]);
        if (! $response->ok()) {
            return null;
        }
        $info = $response->json();
        if (($info['aud'] ?? null) !== $clientId
            || ! in_array($info['iss'] ?? '', ['accounts.google.com', 'https://accounts.google.com'], true)
            || ($info['email_verified'] ?? 'false') !== 'true'
            || empty($info['email'])) {
            return null;
        }

        return $info;
    }

    private function userPayload(User $user): array
    {
        $user->loadMissing('role');

        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'company_id' => $user->company_id,
            'client_id' => $user->client_id,
            'is_platform_admin' => $user->isPlatformAdmin(),
            'role' => $user->role?->name,
            'permissions' => $user->isPlatformAdmin() ? ['*'] : ($user->role?->permissions ?? []),
        ];
    }
}
