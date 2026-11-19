<?php

namespace App\Http\Middleware;

use App\Models\ContentItem;
use App\Models\Meeting;
use App\Models\Task;
use App\Services\AiPolicyService;
use Closure;
use Illuminate\Http\Request;

/**
 * Stops AI actions for a client whose AI policy is "manual" (the AI is turned off for that client).
 * Used on the routes that start an AI run: agent chat and run, run a task, generate media, recommendations,
 * summarize a meeting, revise content.
 */
class EnforceAiPolicy
{
    public function handle(Request $request, Closure $next)
    {
        $user = $request->user();
        if ($user && $user->company_id) {
            $clientId = $this->clientId($request);
            if ($clientId && ! AiPolicyService::aiAllowed($user->company_id, $clientId)) {
                return response()->json(['message' => 'The AI is turned off for this client (manual AI policy).'], 422);
            }
        }

        return $next($request);
    }

    private function clientId(Request $request): ?int
    {
        $id = $request->route('id');
        $uri = $request->route()?->uri() ?? '';

        $found = match (true) {
            str_starts_with($uri, 'api/tasks/') && is_numeric($id) => Task::find($id)?->client_id,
            str_starts_with($uri, 'api/meetings/') && is_numeric($id) => Meeting::find($id)?->client_id,
            str_starts_with($uri, 'api/content/') && is_numeric($id) => ContentItem::find($id)?->client_id,
            default => $request->input('client_id'),
        };

        return is_numeric($found) ? (int) $found : null;
    }
}
