<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Read-only audit trail of the agency (permission audit.view: Owner by default). */
class AuditLogController extends Controller
{
    /** Filters: actor_id, action, subject_type, subject_id, result (success|denied|failed), from, to (dates), per_page (max 100). */
    public function index(Request $request): JsonResponse
    {
        $query = AuditLog::where('company_id', $request->user()->company_id)->with('actor:id,name')->orderByDesc('id');

        foreach (['actor_id', 'action', 'subject_type', 'subject_id', 'result'] as $field) {
            if ($request->filled($field)) {
                $query->where($field, $request->query($field));
            }
        }
        if ($request->filled('from')) {
            $query->where('created_at', '>=', $request->query('from'));
        }
        if ($request->filled('to')) {
            $query->where('created_at', '<=', $request->query('to').' 23:59:59');
        }

        return response()->json($query->paginate(min((int) $request->query('per_page', 50), 100)));
    }
}
