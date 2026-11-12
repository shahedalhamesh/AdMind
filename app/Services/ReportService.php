<?php

namespace App\Services;

use App\Models\Campaign;
use App\Models\Client;
use App\Models\ContentItem;
use App\Models\Goal;
use App\Models\PerformanceMetric;
use Carbon\Carbon;
use Illuminate\Support\Collection;

/**
 * Numbers for goals and client reports, computed from performance_metrics.
 * Additive metrics (reach, likes, spend...) are summed; ratio metrics (ctr...) are averaged.
 */
class ReportService
{
    /** Metrics that are averaged instead of summed. */
    public const AVERAGED = ['ctr', 'engagement_rate', 'cpc', 'cpm', 'cpa'];

    public static function aggregate(Collection $values, string $metric): float
    {
        if ($values->isEmpty()) {
            return 0.0;
        }

        return round(in_array($metric, self::AVERAGED, true) ? $values->avg() : $values->sum(), 4);
    }

    /** Current value of a goal's metric inside the goal's dates, plus its status (also saved). */
    public static function goalProgress(Goal $goal): array
    {
        $values = PerformanceMetric::where('client_id', $goal->client_id)->where('metric', $goal->metric)
            ->whereBetween('metric_date', [$goal->starts_on->toDateString(), $goal->ends_on->toDateString()])
            ->pluck('value')->map(fn ($v) => (float) $v);

        $current = self::aggregate($values, $goal->metric);
        $target = (float) $goal->target_value;
        $progress = $target > 0 ? round($current / $target * 100, 1) : 0.0;

        $today = Carbon::today();
        $total = max(1, $goal->starts_on->diffInDays($goal->ends_on) + 1);
        $elapsed = $today->lt($goal->starts_on) ? 0 : min($total, $goal->starts_on->diffInDays($today) + 1);
        $expected = $elapsed / $total * 100;

        $status = match (true) {
            $current >= $target && $target > 0 => 'achieved',
            $today->gt($goal->ends_on) => 'missed',
            $progress >= $expected * 0.8 => 'on_track',
            default => 'at_risk',
        };

        if ($goal->status !== $status) {
            $goal->forceFill(['status' => $status])->save();
        }

        return ['current' => $current, 'progress_pct' => $progress, 'status' => $status];
    }

    /** The data stored in a client report. */
    public static function clientReport(Client $client, Carbon $from, Carbon $to, string $topMetric = 'reach'): array
    {
        $rows = PerformanceMetric::where('client_id', $client->id)
            ->whereBetween('metric_date', [$from->toDateString(), $to->toDateString()])->get();

        $totals = [];
        foreach ($rows->groupBy('metric') as $metric => $group) {
            $totals[$metric] = self::aggregate($group->pluck('value')->map(fn ($v) => (float) $v), $metric);
        }

        $byPlatform = [];
        foreach ($rows->groupBy('platform') as $platform => $byPlat) {
            foreach ($byPlat->groupBy('metric') as $metric => $group) {
                $byPlatform[$platform][$metric] = self::aggregate($group->pluck('value')->map(fn ($v) => (float) $v), $metric);
            }
        }

        $published = ContentItem::where('client_id', $client->id)
            ->whereBetween('published_at', [$from->copy()->startOfDay(), $to->copy()->endOfDay()])
            ->get(['id', 'title', 'type', 'platform', 'published_at']);

        $top = $rows->where('subject_type', 'content')->where('metric', $topMetric)->groupBy('subject_id')
            ->map(fn ($g, $id) => ['content_id' => (int) $id, 'value' => self::aggregate($g->pluck('value')->map(fn ($v) => (float) $v), $topMetric)])
            ->sortByDesc('value')->take(5)->values();
        $titles = ContentItem::whereIn('id', $top->pluck('content_id'))->pluck('title', 'id');
        $top = $top->map(fn ($t) => $t + ['title' => $titles[$t['content_id']] ?? null])->all();

        $goals = Goal::where('client_id', $client->id)
            ->where('starts_on', '<=', $to->toDateString())->where('ends_on', '>=', $from->toDateString())->get()
            ->map(fn (Goal $g) => [
                'id' => $g->id, 'metric' => $g->metric, 'target' => (float) $g->target_value,
                'period' => $g->period, 'starts_on' => $g->starts_on->toDateString(), 'ends_on' => $g->ends_on->toDateString(),
            ] + self::goalProgress($g))->all();

        $campaigns = Campaign::where('client_id', $client->id)
            ->where(fn ($q) => $q->whereNull('starts_on')->orWhere('starts_on', '<=', $to->toDateString()))
            ->where(fn ($q) => $q->whereNull('ends_on')->orWhere('ends_on', '>=', $from->toDateString()))
            ->get(['id', 'name', 'status', 'budget', 'spent', 'currency'])->all();

        return [
            'client' => ['id' => $client->id, 'name' => $client->name],
            'period' => ['start' => $from->toDateString(), 'end' => $to->toDateString()],
            'totals' => $totals,
            'by_platform' => $byPlatform,
            'content' => [
                'published_count' => $published->count(),
                'published' => $published->map(fn ($c) => [
                    'id' => $c->id, 'title' => $c->title, 'type' => $c->type, 'platform' => $c->platform,
                    'published_at' => $c->published_at?->toIso8601String(),
                ])->all(),
                'top_by' => $topMetric,
                'top' => $top,
            ],
            'goals' => $goals,
            'campaigns' => $campaigns,
            'has_metrics' => $rows->isNotEmpty(),
        ];
    }
}
