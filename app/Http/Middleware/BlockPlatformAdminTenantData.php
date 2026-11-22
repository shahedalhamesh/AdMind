<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Tenant isolation (FR-03): the Platform Admin manages the agencies and their plans (/api/admin/...), but must not
 * read an agency's own data (clients, content, contracts, reports...). Every other route is refused for that user.
 * Only needs to run after auth:sanctum.
 */
class BlockPlatformAdminTenantData
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        // A platform admin is a user without a company (is_platform_admin is computed, not a column).
        if ($user && $user->company_id === null
            && ! $request->is('api/admin/*', 'api/me', 'api/logout')) {
            return response()->json([
                'message' => 'The platform admin manages companies and plans only. An agency\'s data is private to that agency.',
            ], 403);
        }

        return $next($request);
    }
}
