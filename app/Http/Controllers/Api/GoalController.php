<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Client;
use App\Models\Goal;
use App\Services\ReportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/** A target for a client (e.g. 10000 reach this month). Progress comes from performance_metrics. */
class GoalController extends Controller
{
    private const PERIODS = ['weekly', 'monthly', 'quarterly'];

    /** Filters: client_id, status. Each goal comes with current, progress_pct and status. */
    public function index(Request $request): JsonResponse
    {
        $query = Goal::query()->orderByDesc('starts_on')->orderByDesc('id');
        // a client's own login only sees its own client's goals
        if ($request->user()->client_id) {
            $query->where('client_id', $request->user()->client_id);
        }
        foreach (['client_id', 'status'] as $filter) {
            if ($request->filled($filter)) {
                $query->where($filter, $request->query($filter));
            }
        }

        return response()->json($query->get()->map(fn (Goal $g) => $this->present($g)));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'client_id' => ['required', 'integer'],
            'metric' => ['required', 'string', 'max:50', 'regex:/^[a-z][a-z0-9_]*$/'],
            'target_value' => ['required', 'numeric', 'gt:0'],
            'period' => ['required', Rule::in(self::PERIODS)],
            'starts_on' => ['required', 'date'],
            'ends_on' => ['required', 'date'],
        ]);
        $this->checkDates($data['starts_on'], $data['ends_on']);

        $client = Client::findOrFail($data['client_id']);

        $goal = Goal::forceCreate([
            'company_id' => $client->company_id,
            'client_id' => $client->id,
            'metric' => $data['metric'],
            'target_value' => $data['target_value'],
            'period' => $data['period'],
            'starts_on' => $data['starts_on'],
            'ends_on' => $data['ends_on'],
            'status' => 'on_track',
        ]);

        return response()->json($this->present($goal->fresh()), 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $goal = Goal::findOrFail($id);

        $data = $request->validate([
            'metric' => ['sometimes', 'string', 'max:50', 'regex:/^[a-z][a-z0-9_]*$/'],
            'target_value' => ['sometimes', 'numeric', 'gt:0'],
            'period' => ['sometimes', Rule::in(self::PERIODS)],
            'starts_on' => ['sometimes', 'date'],
            'ends_on' => ['sometimes', 'date'],
        ]);
        $this->checkDates($data['starts_on'] ?? $goal->starts_on->toDateString(), $data['ends_on'] ?? $goal->ends_on->toDateString());

        $goal->update($data);

        return response()->json($this->present($goal->fresh()));
    }

    public function destroy(int $id): JsonResponse
    {
        Goal::findOrFail($id)->delete();

        return response()->json(['message' => 'Goal deleted.']);
    }

    private function present(Goal $goal): array
    {
        $progress = ReportService::goalProgress($goal);

        return [
            'id' => $goal->id,
            'client_id' => $goal->client_id,
            'metric' => $goal->metric,
            'target_value' => (float) $goal->target_value,
            'period' => $goal->period,
            'starts_on' => $goal->starts_on->toDateString(),
            'ends_on' => $goal->ends_on->toDateString(),
        ] + $progress;
    }

    private function checkDates(string $start, string $end): void
    {
        if (strtotime($end) < strtotime($start)) {
            throw ValidationException::withMessages(['ends_on' => 'ends_on must be on or after starts_on.']);
        }
    }
}
