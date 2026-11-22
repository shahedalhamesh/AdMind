<?php

namespace App\Http\Middleware;

use App\Models\AuditLog;
use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Writes one audit_logs row for every change (POST, PUT, PATCH, DELETE) a signed-in agency user makes:
 * who, what, on which record, the (cleaned) input, the HTTP status and the result.
 * It never breaks the request: a logging problem is only reported.
 */
class AuditRequests
{
    private const SKIP = ['logout', 'notifications'];
    private const SENSITIVE = ['password', 'password_confirmation', 'current_password', 'new_password', 'token', 'credential', 'api_key', 'secret'];

    public function handle(Request $request, Closure $next)
    {
        $response = $next($request);

        try {
            $this->record($request, $response);
        } catch (\Throwable $e) {
            report($e);
        }

        return $response;
    }

    private function record(Request $request, $response): void
    {
        if (! in_array($request->method(), ['POST', 'PUT', 'PATCH', 'DELETE'], true)) {
            return;
        }
        $user = $request->user();
        if (! $user || ! $user->company_id) {
            return; // Platform Admin actions are not part of an agency's log
        }

        $route = $request->route();
        $uri = preg_replace('#^api/#', '', $route?->uri() ?? $request->path());
        $fixed = array_values(array_filter(explode('/', $uri), fn ($s) => $s !== '' && ! str_starts_with($s, '{')));
        if (! $fixed || in_array($fixed[0], self::SKIP, true)) {
            return;
        }

        $verb = ['POST' => 'create', 'PUT' => 'update', 'PATCH' => 'update', 'DELETE' => 'delete'][$request->method()];
        $extra = array_slice($fixed, 1);
        $action = $extra ? implode('.', $extra) : $verb;

        $status = $response->getStatusCode();
        $subjectId = $route?->parameter('id');
        if (! is_numeric($subjectId) && $status === 201 && $response instanceof JsonResponse) {
            $subjectId = $response->getData(true)['id'] ?? null;
        }

        AuditLog::forceCreate([
            'company_id' => $user->company_id,
            'actor_type' => 'user',
            'actor_id' => $user->id,
            'action' => $action,
            'subject_type' => $fixed[0],
            'subject_id' => is_numeric($subjectId) ? (int) $subjectId : null,
            'changes' => ['method' => $request->method(), 'path' => $request->path(), 'status' => $status, 'input' => $this->clean($request->except(['_token']))],
            'result' => $status < 400 ? 'success' : (in_array($status, [401, 403], true) ? 'denied' : 'failed'),
            'ip_address' => $request->ip(),
        ]);
    }

    private function clean(array $input): array
    {
        $out = [];
        foreach ($input as $key => $value) {
            if (in_array(strtolower((string) $key), self::SENSITIVE, true)) {
                $out[$key] = '***';
            } elseif (is_array($value)) {
                $out[$key] = $this->clean($value);
            } elseif (is_string($value)) {
                $out[$key] = mb_strlen($value) > 300 ? mb_substr($value, 0, 300).'…' : $value;
            } elseif (is_scalar($value) || $value === null) {
                $out[$key] = $value;
            } else {
                $out[$key] = '[file]';
            }
        }

        return $out;
    }
}
