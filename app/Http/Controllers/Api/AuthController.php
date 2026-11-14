<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Company;
use App\Models\Plan;
use App\Models\Role;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;

class AuthController extends Controller
{
    /**
     * A new agency signs up: creates the company (free plan, trial), its four default roles and the first
     * user, who becomes the Owner. Returns the same payload as login (the Owner is logged in at once).
     */
    public function register(Request $request): JsonResponse
    {
        $data = $request->validate([
            'company_name' => ['required', 'string', 'max:255'],
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email:rfc', 'max:255', 'unique:users,email'],
            'password' => ['required', 'string', 'min:8', 'max:100'],
            'device_name' => ['nullable', 'string', 'max:100'],
        ]);

        $user = DB::transaction(function () use ($data) {
            $plan = Plan::where('slug', 'free')->where('is_active', true)->first();

            $company = Company::forceCreate([
                'name' => $data['company_name'],
                'plan' => 'free',
                'plan_id' => $plan?->id,
                'subscription_status' => 'trial',
                'features' => [],
            ]);

            $roles = [];
            foreach (config('permissions.roles') as $roleName => $permissions) {
                $roles[$roleName] = Role::forceCreate([
                    'company_id' => $company->id, 'name' => $roleName, 'permissions' => $permissions,
                ]);
            }

            return User::forceCreate([
                'company_id' => $company->id,
                'role_id' => $roles['Owner']->id,
                'name' => $data['name'],
                'email' => mb_strtolower($data['email']),
                'password' => $data['password'],
                'status' => 'active',
                'last_login_at' => now(),
            ]);
        });

        return response()->json([
            'token' => $user->createToken($data['device_name'] ?? 'api')->plainTextToken,
            'user' => $this->userPayload($user),
        ], 201);
    }

    public function login(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
            'device_name' => ['nullable', 'string', 'max:100'],
        ]);

        $user = User::where('email', $data['email'])->first();

        if (! $user || ! Hash::check($data['password'], $user->password)) {
            return response()->json(['message' => 'Invalid email or password.'], 422);
        }

        if (! $user->isActive()) {
            return response()->json(['message' => 'This account is disabled.'], 403);
        }

        if ($message = $this->companyBlockedMessage($user)) {
            return response()->json(['message' => $message], 403);
        }

        $user->forceFill(['last_login_at' => now()])->save();

        $token = $user->createToken($data['device_name'] ?? 'api')->plainTextToken;

        return response()->json([
            'token' => $token,
            'user' => $this->userPayload($user),
        ]);
    }

    /**
     * Sign in with Google. The frontend gets a Google ID token (`credential`) with Google Identity Services
     * and sends it here. The token is checked with Google; the Google email must belong to an existing,
     * active AdMind account (accounts are created by the company, never by Google sign-in).
     */
    public function loginGoogle(Request $request): JsonResponse
    {
        $data = $request->validate([
            'credential' => ['required', 'string'],
            'device_name' => ['nullable', 'string', 'max:100'],
        ]);

        $clientId = config('services.google.client_id');
        if (! $clientId) {
            return response()->json(['message' => 'Google sign-in is not configured.'], 503);
        }

        $response = Http::timeout(10)->get('https://oauth2.googleapis.com/tokeninfo', ['id_token' => $data['credential']]);
        if (! $response->ok()) {
            return response()->json(['message' => 'Invalid Google token.'], 422);
        }

        $info = $response->json();
        if (($info['aud'] ?? null) !== $clientId
            || ! in_array($info['iss'] ?? '', ['accounts.google.com', 'https://accounts.google.com'], true)
            || ($info['email_verified'] ?? 'false') !== 'true'
            || empty($info['email'])) {
            return response()->json(['message' => 'Invalid Google token.'], 422);
        }

        $user = User::where('email', $info['email'])->first();
        if (! $user) {
            return response()->json(['message' => 'No AdMind account uses this Google email. Ask your manager to create one.'], 403);
        }
        if (! $user->isActive()) {
            return response()->json(['message' => 'This account is disabled.'], 403);
        }

        if ($message = $this->companyBlockedMessage($user)) {
            return response()->json(['message' => $message], 403);
        }

        $user->forceFill(['last_login_at' => now()])->save();

        return response()->json([
            'token' => $user->createToken($data['device_name'] ?? 'google')->plainTextToken,
            'user' => $this->userPayload($user),
        ]);
    }

    public function me(Request $request): JsonResponse
    {
        return response()->json($this->userPayload($request->user()));
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json(['message' => 'Logged out.']);
    }

    /** A suspended or cancelled company cannot sign in (the Platform Admin has no company). */
    private function companyBlockedMessage(User $user): ?string
    {
        if ($user->company_id === null) {
            return null;
        }
        $status = Company::whereKey($user->company_id)->value('subscription_status');

        return in_array($status, ['suspended', 'cancelled'], true)
            ? 'This company subscription is not active. Contact support.' : null;
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
