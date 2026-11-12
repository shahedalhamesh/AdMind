<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Campaign;
use App\Models\Client;
use App\Models\ContentItem;
use App\Models\PerformanceMetric;
use App\Models\SocialAccount;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/**
 * Performance numbers (reach, likes, clicks, spend...) per content item, campaign or social account, per day.
 * Entered by hand (or imported) for now; the platforms' APIs can fill the same table later.
 * Sending the same subject + platform + metric + date again replaces the value.
 */
class MetricController extends Controller
{
    /** Filters: client_id (required), metric, platform, subject_type, subject_id, from, to, per_page (max 200). */
    public function index(Request $request): JsonResponse
    {
        $request->validate(['client_id' => ['required', 'integer']]);
        $client = Client::findOrFail($request->query('client_id'));
        // a client's own login only sees its own client's numbers
        abort_if($request->user()->client_id && $request->user()->client_id !== $client->id, 404);

        $query = PerformanceMetric::where('client_id', $client->id)->orderByDesc('metric_date')->orderBy('id');
        foreach (['metric', 'platform', 'subject_type', 'subject_id'] as $filter) {
            if ($request->filled($filter)) {
                $query->where($filter, $request->query($filter));
            }
        }
        if ($request->filled('from')) {
            $query->where('metric_date', '>=', $request->query('from'));
        }
        if ($request->filled('to')) {
            $query->where('metric_date', '<=', $request->query('to'));
        }

        return response()->json($query->paginate(min((int) $request->query('per_page', 50), 200)));
    }

    /** Body: client_id and metrics[] (1 to 200 rows: subject_type, subject_id, platform, metric, value, metric_date). */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'client_id' => ['required', 'integer'],
            'metrics' => ['required', 'array', 'min:1', 'max:200'],
            'metrics.*.subject_type' => ['required', Rule::in(['content', 'campaign', 'account'])],
            'metrics.*.subject_id' => ['required', 'integer'],
            'metrics.*.platform' => ['required', Rule::in(['instagram', 'facebook', 'tiktok', 'x', 'linkedin', 'snapchat'])],
            'metrics.*.metric' => ['required', 'string', 'max:50', 'regex:/^[a-z][a-z0-9_]*$/'],
            'metrics.*.value' => ['required', 'numeric'],
            'metrics.*.metric_date' => ['required', 'date', 'before_or_equal:today'],
        ]);

        $client = Client::findOrFail($data['client_id']);

        // every subject must belong to this client (404 otherwise, nothing is saved)
        foreach ($data['metrics'] as $m) {
            match ($m['subject_type']) {
                'content' => ContentItem::where('client_id', $client->id)->findOrFail($m['subject_id']),
                'campaign' => Campaign::where('client_id', $client->id)->findOrFail($m['subject_id']),
                'account' => SocialAccount::where('client_id', $client->id)->findOrFail($m['subject_id']),
            };
        }

        $saved = DB::transaction(function () use ($data, $client) {
            $count = 0;
            foreach ($data['metrics'] as $m) {
                $row = PerformanceMetric::where('client_id', $client->id)
                    ->where('subject_type', $m['subject_type'])->where('subject_id', $m['subject_id'])
                    ->where('platform', $m['platform'])->where('metric', $m['metric'])
                    ->whereDate('metric_date', $m['metric_date'])->first();

                $fields = ['value' => $m['value'], 'collected_at' => now(), 'is_stale' => false];
                if ($row) {
                    $row->forceFill($fields)->save();
                } else {
                    PerformanceMetric::forceCreate($fields + [
                        'company_id' => $client->company_id,
                        'client_id' => $client->id,
                        'subject_type' => $m['subject_type'],
                        'subject_id' => $m['subject_id'],
                        'platform' => $m['platform'],
                        'metric' => $m['metric'],
                        'metric_date' => $m['metric_date'],
                    ]);
                }
                $count++;
            }

            return $count;
        });

        return response()->json(['saved' => $saved], 201);
    }
}
