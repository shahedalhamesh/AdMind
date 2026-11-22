<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Client;
use App\Models\SatisfactionFeedback;
use App\Services\ContentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * How satisfied clients are. The team records feedback (clients.update); a client login can leave its own
 * feedback (permission requests.create). Low ratings and complaints notify the managers.
 * Sentiment comes from the rating when not given: 4 or 5 positive, 3 neutral, 1 or 2 negative.
 */
class SatisfactionController extends Controller
{
    /** A client's feedback (newest first) and a summary. Filters: sentiment, source, per_page (max 100). */
    public function index(Request $request, int $clientId): JsonResponse
    {
        Client::findOrFail($clientId);
        $base = SatisfactionFeedback::where('client_id', $clientId);

        $query = (clone $base)->orderByDesc('id');
        foreach (['sentiment', 'source'] as $field) {
            if ($request->filled($field)) {
                $query->where($field, $request->query($field));
            }
        }

        return response()->json([
            'summary' => $this->summary($base->get()),
            'feedback' => $query->paginate(min((int) $request->query('per_page', 30), 100)),
        ]);
    }

    /** One row per client: average rating, counts and an "at risk" flag. For a dashboard. Query: days (default 90). */
    public function overview(Request $request): JsonResponse
    {
        $days = max(1, min((int) $request->query('days', 90), 365));
        $rows = SatisfactionFeedback::where('created_at', '>=', now()->subDays($days))->get()->groupBy('client_id');
        $names = Client::whereIn('id', $rows->keys())->pluck('name', 'id');

        $clients = $rows->map(function ($items, $clientId) use ($names) {
            $summary = $this->summary($items);

            return ['client_id' => (int) $clientId, 'client_name' => $names[$clientId] ?? null] + $summary;
        })->sortBy(fn ($r) => $r['average_rating'] ?? 99)->values();

        return response()->json(['days' => $days, 'clients' => $clients]);
    }

    /** Staff records feedback for a client. Body: source (survey|message|complaint), rating 1-5, comment, sentiment, topic. */
    public function store(Request $request, int $clientId): JsonResponse
    {
        $client = Client::findOrFail($clientId);
        $data = $request->validate([
            'source' => ['required', 'in:survey,message,complaint'],
            'rating' => ['nullable', 'integer', 'between:1,5'],
            'comment' => ['nullable', 'string', 'max:3000'],
            'sentiment' => ['nullable', 'in:positive,neutral,negative'],
            'topic' => ['nullable', 'string', 'max:100'],
        ]);
        abort_if(empty($data['rating']) && empty($data['comment']), 422, 'Send a rating or a comment.');

        return response()->json($this->save($client, $data), 201);
    }

    /** A client login leaves its own feedback. Body: rating 1-5, comment, topic. */
    public function submit(Request $request): JsonResponse
    {
        $user = $request->user();
        abort_unless($user->client_id, 403, 'Only a client account can use this.');
        $client = Client::findOrFail($user->client_id);

        $data = $request->validate([
            'rating' => ['nullable', 'integer', 'between:1,5'],
            'comment' => ['nullable', 'string', 'max:3000'],
            'topic' => ['nullable', 'string', 'max:100'],
        ]);
        abort_if(empty($data['rating']) && empty($data['comment']), 422, 'Send a rating or a comment.');

        return response()->json($this->save($client, $data + ['source' => 'survey']), 201);
    }

    public function destroy(int $id): JsonResponse
    {
        SatisfactionFeedback::findOrFail($id)->delete();

        return response()->json(['deleted' => true]);
    }

    // ------------------------------------------------------------ helpers

    private function save(Client $client, array $data): SatisfactionFeedback
    {
        $rating = $data['rating'] ?? null;
        $sentiment = $data['sentiment'] ?? match (true) {
            $rating === null => null,
            $rating >= 4 => 'positive',
            $rating === 3 => 'neutral',
            default => 'negative',
        };

        $item = SatisfactionFeedback::forceCreate([
            'company_id' => $client->company_id,
            'client_id' => $client->id,
            'source' => $data['source'],
            'rating' => $rating,
            'comment' => $data['comment'] ?? null,
            'sentiment' => $sentiment,
            'topic' => $data['topic'] ?? null,
        ]);

        if ($sentiment === 'negative' || $data['source'] === 'complaint') {
            ContentService::notify($client->company_id, ContentService::managerIds($client->company_id), 'low_satisfaction',
                "Unhappy feedback from {$client->name}", $item->comment ? mb_substr($item->comment, 0, 200) : "Rating {$rating}/5",
                ['client_id' => $client->id, 'feedback_id' => $item->id]);
        }

        return $item;
    }

    /** average_rating (null without ratings), count, by_sentiment, top_topics, at_risk (average under 3 or 2+ negative). */
    private function summary($items): array
    {
        $rated = $items->whereNotNull('rating');
        $negative = $items->where('sentiment', 'negative')->count();
        $average = $rated->count() ? round($rated->avg('rating'), 2) : null;

        return [
            'average_rating' => $average,
            'count' => $items->count(),
            'by_sentiment' => [
                'positive' => $items->where('sentiment', 'positive')->count(),
                'neutral' => $items->where('sentiment', 'neutral')->count(),
                'negative' => $negative,
            ],
            'top_topics' => $items->whereNotNull('topic')->groupBy('topic')->map->count()->sortDesc()->take(5)->all(),
            'at_risk' => ($average !== null && $average < 3) || $negative >= 2,
        ];
    }
}
