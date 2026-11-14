<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Client;
use App\Models\Report;
use App\Services\ReportService;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Client performance reports, built from the performance numbers, saved as a snapshot.
 * A report is hidden from the client's own login until someone sets visible_to_client.
 */
class ReportController extends Controller
{
    /** Filters: client_id, per_page (max 100). The list has no `data` (open one report to get it). */
    public function index(Request $request): JsonResponse
    {
        $query = $this->visible($request)->orderByDesc('generated_at')->orderByDesc('id');
        if ($request->filled('client_id')) {
            $query->where('client_id', $request->query('client_id'));
        }

        return response()->json(
            $query->select(['id', 'client_id', 'type', 'period_start', 'period_end', 'visible_to_client', 'generated_by', 'generated_at'])
                ->paginate(min((int) $request->query('per_page', 20), 100))
        );
    }

    public function show(Request $request, int $id): JsonResponse
    {
        return response()->json($this->visible($request)->findOrFail($id));
    }

    /** Body: client_id, period_start, period_end, top_metric (default reach), visible_to_client (default false). */
    public function generate(Request $request): JsonResponse
    {
        $data = $request->validate([
            'client_id' => ['required', 'integer'],
            'period_start' => ['required', 'date'],
            'period_end' => ['required', 'date', 'after_or_equal:period_start'],
            'top_metric' => ['nullable', 'string', 'max:50'],
            'visible_to_client' => ['nullable', 'boolean'],
        ]);

        $client = Client::findOrFail($data['client_id']);
        $from = Carbon::parse($data['period_start']);
        $to = Carbon::parse($data['period_end']);

        $report = Report::forceCreate([
            'company_id' => $client->company_id,
            'client_id' => $client->id,
            'type' => 'client',
            'period_start' => $from->toDateString(),
            'period_end' => $to->toDateString(),
            'data' => ReportService::clientReport($client, $from, $to, $data['top_metric'] ?? 'reach'),
            'visible_to_client' => (bool) ($data['visible_to_client'] ?? false),
            'generated_by' => 'user:' . $request->user()->id,
            'generated_at' => now(),
        ]);

        return response()->json($report, 201);
    }

    /** Show or hide a report for the client's login. Body: {"visible_to_client": true} */
    public function visibility(Request $request, int $id): JsonResponse
    {
        $report = Report::findOrFail($id);
        $data = $request->validate(['visible_to_client' => ['required', 'boolean']]);
        $report->forceFill(['visible_to_client' => $data['visible_to_client']])->save();

        return response()->json($report);
    }

    public function destroy(int $id): JsonResponse
    {
        Report::findOrFail($id)->delete();

        return response()->json(['message' => 'Report deleted.']);
    }

    private function visible(Request $request): Builder
    {
        $query = Report::query();
        $user = $request->user();

        if ($user->client_id) {
            $query->where('client_id', $user->client_id)->where('visible_to_client', true);
        }

        return $query;
    }
}
