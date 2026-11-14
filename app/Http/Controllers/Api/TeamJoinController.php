<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Company;
use App\Models\JoinLink;
use App\Models\JoinRequest;
use App\Models\Role;
use App\Models\User;
use App\Services\ContentService;
use App\Services\GoogleIdentity;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

/**
 * A public "join the team" link for one role (never Owner or Client). Anyone with the link can ask to join;
 * nothing happens until an Owner approves the request (permission users.create). Then the person signs in
 * normally (with Google or the password they chose). Personal invitations are in InvitationController.
 */
class TeamJoinController extends Controller
{
    /** Roles that can be offered through a public link. */
    private const FORBIDDEN_ROLES = ['Owner', 'Client'];

    // ------------------------------------------------------- links (team)

    public function links(Request $request): JsonResponse
    {
        $links = JoinLink::where('company_id', $this->companyId($request))->with('role:id,name')->orderByDesc('id')->get();
        if ($request->filled('status')) {
            $links = $links->where('status', $request->query('status'))->values();
        }

        return response()->json($links);
    }

    /** Body: role_id, label, expires_in_days (1 to 90, default 30), max_uses (optional). The token is shown only once. */
    public function createLink(Request $request): JsonResponse
    {
        $companyId = $this->companyId($request);
        $data = $request->validate([
            'role_id' => ['required', 'integer', Rule::exists('roles', 'id')->where('company_id', $companyId)],
            'label' => ['nullable', 'string', 'max:100'],
            'expires_in_days' => ['nullable', 'integer', 'min:1', 'max:90'],
            'max_uses' => ['nullable', 'integer', 'min:1', 'max:1000'],
        ]);
        $this->checkRole((int) $data['role_id']);

        $token = Str::random(48);
        $link = JoinLink::forceCreate([
            'company_id' => $companyId,
            'role_id' => $data['role_id'],
            'label' => $data['label'] ?? null,
            'token_hash' => JoinLink::hashToken($token),
            'created_by_user_id' => $request->user()->id,
            'expires_at' => now()->addDays($data['expires_in_days'] ?? 30),
            'max_uses' => $data['max_uses'] ?? null,
        ]);

        return response()->json($link->load('role:id,name')->toArray() + ['token' => $token], 201);
    }

    public function revokeLink(Request $request, int $id): JsonResponse
    {
        $link = JoinLink::where('company_id', $this->companyId($request))->findOrFail($id);
        abort_if($link->revoked_at !== null, 422, 'This link was already revoked.');
        $link->forceFill(['revoked_at' => now()])->save();

        return response()->json($link->fresh());
    }

    // ------------------------------------------------- requests (team)

    /** Filters: status (pending|approved|rejected; default all). */
    public function requests(Request $request): JsonResponse
    {
        $query = JoinRequest::where('company_id', $this->companyId($request))->with('role:id,name')->orderByDesc('id');
        if ($request->filled('status')) {
            $query->where('status', $request->query('status'));
        }

        return response()->json($query->get());
    }

    /** Approve: creates the account. Body (optional): role_id to give a different role than the link's. */
    public function approve(Request $request, int $id): JsonResponse
    {
        $companyId = $this->companyId($request);
        $data = $request->validate([
            'role_id' => ['nullable', 'integer', Rule::exists('roles', 'id')->where('company_id', $companyId)],
        ]);
        if (! empty($data['role_id'])) {
            $this->checkRole((int) $data['role_id']);
        }

        $user = DB::transaction(function () use ($companyId, $id, $data, $request) {
            $req = JoinRequest::where('company_id', $companyId)->lockForUpdate()->findOrFail($id);
            abort_unless($req->status === 'pending', 422, 'This request was already decided.');
            abort_if(User::where('email', $req->email)->exists(), 422, 'A user with this email already exists.');

            $user = User::forceCreate([
                'company_id' => $companyId,
                'role_id' => $data['role_id'] ?? $req->role_id,
                'name' => $req->name,
                'email' => $req->email,
                'password' => $req->password_hash, // already hashed
                'status' => 'active',
            ]);
            $req->forceFill([
                'status' => 'approved', 'decided_by_user_id' => $request->user()->id,
                'decided_at' => now(), 'user_id' => $user->id,
            ])->save();

            return $user;
        });

        return response()->json($user->load('role:id,name'), 201);
    }

    public function reject(Request $request, int $id): JsonResponse
    {
        $req = JoinRequest::where('company_id', $this->companyId($request))->findOrFail($id);
        abort_unless($req->status === 'pending', 422, 'This request was already decided.');
        $req->forceFill(['status' => 'rejected', 'decided_by_user_id' => $request->user()->id, 'decided_at' => now()])->save();

        return response()->json($req->fresh());
    }

    // ---------------------------------------------------- public pages

    public function preview(string $token): JsonResponse
    {
        $link = $this->findActive($token);

        return response()->json([
            'company_name' => Company::whereKey($link->company_id)->value('name'),
            'role' => Role::whereKey($link->role_id)->value('name'),
            'label' => $link->label,
            'expires_at' => $link->expires_at,
        ]);
    }

    /**
     * Ask to join. Body: either `credential` (Google ID token; the name and email come from Google, `name`
     * may override) or `name` + `email` + `password` (min 8). Returns 202: the request waits for approval,
     * and the person is NOT signed in. After approval they sign in normally.
     */
    public function submit(Request $request, string $token): JsonResponse
    {
        $link = $this->findActive($token);
        $data = $request->validate([
            'credential' => ['nullable', 'string'],
            'name' => ['nullable', 'string', 'max:255'],
            'email' => ['nullable', 'email:rfc', 'max:255'],
            'password' => ['nullable', 'string', 'min:8', 'max:100'],
        ]);

        if (! empty($data['credential'])) {
            abort_unless(GoogleIdentity::configured(), 503, 'Google sign-in is not configured.');
            $info = GoogleIdentity::verify($data['credential']);
            if ($info === null) {
                return response()->json(['message' => 'Invalid Google token.'], 422);
            }
            $email = mb_strtolower($info['email']);
            $name = trim($data['name'] ?? '') ?: ($info['name'] ?? Str::before($email, '@'));
            $password = Str::random(40); // never used: this person signs in with Google
            $viaGoogle = true;
        } else {
            $request->validate(['name' => ['required'], 'email' => ['required'], 'password' => ['required']]);
            $email = mb_strtolower($data['email']);
            $name = $data['name'];
            $password = $data['password'];
            $viaGoogle = false;
        }

        abort_if(User::where('email', $email)->exists(), 422, 'A user with this email already exists.');

        DB::transaction(function () use ($link, $email, $name, $password, $viaGoogle) {
            $fresh = JoinLink::withoutGlobalScopes()->lockForUpdate()->findOrFail($link->id);
            abort_unless($fresh->status === 'active', 404, 'This link is not valid.');
            abort_if(JoinRequest::withoutGlobalScopes()->where('company_id', $fresh->company_id)
                ->where('email', $email)->where('status', 'pending')->exists(), 422, 'A request with this email is already waiting for approval.');

            JoinRequest::forceCreate([
                'company_id' => $fresh->company_id,
                'join_link_id' => $fresh->id,
                'role_id' => $fresh->role_id,
                'name' => $name,
                'email' => $email,
                'password_hash' => Hash::make($password),
                'via_google' => $viaGoogle,
                'status' => 'pending',
            ]);
            $fresh->increment('uses_count');
        });

        $owners = User::where('company_id', $link->company_id)->where('status', 'active')
            ->whereHas('role', fn ($q) => $q->where('name', 'Owner'))->pluck('id')->all();
        ContentService::notify($link->company_id, $owners, 'join_request', "{$name} asks to join the team", $email, ['email' => $email]);

        return response()->json(['status' => 'pending', 'message' => 'Your request was sent. You can sign in after an Owner approves it.'], 202);
    }

    // ------------------------------------------------------------ helpers

    private function findActive(string $token): JoinLink
    {
        $link = JoinLink::withoutGlobalScopes()->where('token_hash', JoinLink::hashToken($token))->first();
        abort_unless($link && $link->status === 'active', 404, 'This link is not valid.');
        $status = Company::whereKey($link->company_id)->value('subscription_status');
        abort_if(in_array($status, ['suspended', 'cancelled'], true), 404, 'This link is not valid.');

        return $link;
    }

    private function companyId(Request $request): int
    {
        $id = $request->user()->company_id;
        abort_if($id === null, 403, 'Use an agency account to manage the team.');

        return $id;
    }

    private function checkRole(int $roleId): void
    {
        abort_if(in_array(Role::whereKey($roleId)->value('name'), self::FORBIDDEN_ROLES, true), 422,
            'A public link or an approval cannot give the Owner or Client role. Use a personal invitation.');
    }
}
