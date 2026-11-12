<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Client;
use App\Models\SocialAccount;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * The client's social media accounts (where content gets published).
 * For now an account is registered by hand (platform + name). Connecting a real account with the
 * platform's own login (OAuth) comes later; the token fields stay empty until then.
 */
class SocialAccountController extends Controller
{
    public function index(int $id): JsonResponse
    {
        $client = Client::findOrFail($id);

        return response()->json(
            SocialAccount::where('client_id', $client->id)->orderBy('platform')
                ->get(['id', 'client_id', 'platform', 'account_name', 'status', 'created_at'])
        );
    }

    public function store(Request $request, int $id): JsonResponse
    {
        $client = Client::findOrFail($id);

        $data = $request->validate([
            'platform' => ['required', Rule::in(['instagram', 'facebook', 'tiktok', 'x', 'linkedin', 'snapchat'])],
            'account_name' => ['required', 'string', 'max:255'],
        ]);

        abort_if(
            SocialAccount::where('client_id', $client->id)->where('platform', $data['platform'])
                ->where('account_name', $data['account_name'])->exists(),
            422,
            'This account is already added.'
        );

        $account = SocialAccount::forceCreate([
            'company_id' => $client->company_id,
            'client_id' => $client->id,
            'platform' => $data['platform'],
            'account_name' => $data['account_name'],
            'access_token' => 'manual', // no real connection yet
            'status' => 'connected',
        ]);

        return response()->json($account->only(['id', 'client_id', 'platform', 'account_name', 'status']), 201);
    }

    /** Removing an account that still has scheduled posts is refused: cancel them first. */
    public function destroy(int $id, int $accountId): JsonResponse
    {
        $account = SocialAccount::where('client_id', Client::findOrFail($id)->id)->findOrFail($accountId);

        abort_if(
            $account->publishJobs()->whereIn('status', ['pending', 'publishing'])->exists(),
            422,
            'This account has scheduled posts. Cancel them first.'
        );

        $account->delete();

        return response()->json(['message' => 'Account removed.']);
    }
}
