<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AgentRun;
use App\Models\Recommendation;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * How well the AI agents work: runs, success rate, speed, token use, cost, corrections made by the fact-check.
 * Permission reports.create (Owner, Manager). Default period: the last 30 days.
 */
class AgentPerformanceController extends Controller
{
    /** Query: from, to (dates), client_id (optional). */
    public function index(Request $request): JsonResponse
    {
        $companyId = $request->user()->company_id;
        $data = $request->validate([
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
            'client_id' => ['nullable', 'integer', Rule::exists('clients', 'id')->where('company_id', $companyId)],
        ]);

        $to = isset($data['to']) ? \Carbon\Carbon::parse($data['to'])->endOfDay() : now()->endOfDay();
        $from = isset($data['from']) ? \Carbon\Carbon::parse($data['from'])->startOfDay() : $to->copy()->subDays(29)->startOfDay();
        abort_if($from->diffInDays($to) > 366, 422, 'The period can be at most one year.');

        $base = AgentRun::where('company_id', $companyId)->whereBetween('started_at', [$from, $to]);
        if (! empty($data['client_id'])) {
            $base->where('client_id', $data['client_id']);
        }

        $rows = (clone $base)->selectRaw(
            "agent, status, verification_status, JSON_UNQUOTE(JSON_EXTRACT(input, '$.mode')) as mode,
             TIMESTAMPDIFF(SECOND, started_at, finished_at) as secs, input_tokens, output_tokens, cost, DATE(started_at) as day"
        )->limit(20000)->get();

        $failures = (clone $base)->where('status', 'failed')->orderByDesc('id')->limit(10)
            ->get(['id', 'agent', 'client_id', 'error', 'started_at'])
            ->map(fn ($r) => ['id' => $r->id, 'agent' => $r->agent, 'client_id' => $r->client_id,
                'error' => $r->error ? mb_substr($r->error, 0, 200) : null, 'started_at' => $r->started_at]);

        $recs = Recommendation::where('company_id', $companyId)->whereBetween('created_at', [$from, $to])
            ->when(! empty($data['client_id']), fn ($q) => $q->where('client_id', $data['client_id']))
            ->selectRaw('status, count(*) as n')->groupBy('status')->pluck('n', 'status');

        return response()->json([
            'period' => ['from' => $from->toDateString(), 'to' => $to->toDateString()],
            'totals' => $this->stats($rows),
            'by_agent' => $rows->groupBy('agent')->map(fn ($g, $agent) => ['agent' => $agent] + $this->stats($g))->sortByDesc('runs')->values(),
            'by_mode' => $rows->groupBy(fn ($r) => $r->mode ?: 'run')->map(fn ($g, $mode) => ['mode' => $mode] + $this->stats($g))->sortByDesc('runs')->values(),
            'by_day' => $rows->groupBy('day')->map(fn ($g, $day) => ['date' => $day, 'runs' => $g->count(), 'failed' => $g->where('status', 'failed')->count()])->sortKeys()->values(),
            'recent_failures' => $failures,
            'recommendations' => ['new' => (int) ($recs['new'] ?? 0), 'accepted' => (int) ($recs['accepted'] ?? 0), 'dismissed' => (int) ($recs['dismissed'] ?? 0)],
        ]);
    }

    private function stats($rows): array
    {
        $finished = $rows->where('status', '!=', 'running');
        $timed = $rows->whereNotNull('secs')->where('status', '!=', 'running');

        return [
            'runs' => $rows->count(),
            'succeeded' => $rows->where('status', 'succeeded')->count(),
            'failed' => $rows->where('status', 'failed')->count(),
            'running' => $rows->where('status', 'running')->count(),
            'success_rate' => $finished->count() ? round($rows->where('status', 'succeeded')->count() / $finished->count() * 100, 1) : null,
            'avg_duration_seconds' => $timed->count() ? (int) round($timed->avg('secs')) : null,
            'input_tokens' => (int) $rows->sum('input_tokens'),
            'output_tokens' => (int) $rows->sum('output_tokens'),
            'cost' => round((float) $rows->sum('cost'), 4),
            'corrected_by_fact_check' => $rows->where('verification_status', 'corrected')->count(),
            'fact_check_failed' => $rows->where('verification_status', 'failed')->count(),
        ];
    }
}
