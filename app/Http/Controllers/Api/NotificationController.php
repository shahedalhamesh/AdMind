<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Notification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** The logged-in user's own notifications. */
class NotificationController extends Controller
{
    /** Filters: unread=1, per_page (max 100). Includes unread_count. */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $query = Notification::where('user_id', $user->id)->orderByDesc('id');

        if ($request->boolean('unread')) {
            $query->whereNull('read_at');
        }

        return response()->json([
            'unread_count' => Notification::where('user_id', $user->id)->whereNull('read_at')->count(),
            'notifications' => $query->paginate(min((int) $request->query('per_page', 20), 100)),
        ]);
    }

    public function read(Request $request, int $id): JsonResponse
    {
        $n = Notification::where('user_id', $request->user()->id)->findOrFail($id);
        if (! $n->read_at) {
            $n->forceFill(['read_at' => now()])->save();
        }

        return response()->json($n);
    }

    public function readAll(Request $request): JsonResponse
    {
        $count = Notification::where('user_id', $request->user()->id)->whereNull('read_at')->update(['read_at' => now()]);

        return response()->json(['marked' => $count]);
    }
}
