<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\BrandIdentity;
use App\Models\Client;
use App\Services\AiService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use RuntimeException;

/**
 * The brand profile of a client. Laravel is the source of truth (brand_identities);
 * every save is also pushed to the AI service so the agents write in the client's voice.
 */
class ClientProfileController extends Controller
{
    public function __construct(private AiService $ai)
    {
    }

    public function show(int $id): JsonResponse
    {
        $client = Client::findOrFail($id);

        return response()->json(['profile' => BrandIdentity::where('client_id', $client->id)->first()]);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $client = Client::findOrFail($id);

        $data = $request->validate([
            'tone' => ['required', 'string', 'max:255'],
            'target_audience' => ['required', 'string'],
            'content_style' => ['nullable', 'string'],
            'guidelines' => ['nullable', 'string'],
            'colors' => ['nullable', 'array'],
            'fonts' => ['nullable', 'array'],
            'forbidden_words' => ['nullable', 'array'],
            'forbidden_words.*' => ['string'],
            'platforms' => ['nullable', 'array'],
            'platforms.*' => ['string'],
        ]);

        // company_id is guarded against mass assignment, so it is set with forceFill
        $profile = BrandIdentity::firstOrNew(['client_id' => $client->id]);
        $profile->forceFill([
            'company_id' => $client->company_id,
            'tone' => $data['tone'],
            'target_audience' => $data['target_audience'],
            'content_style' => $data['content_style'] ?? '',
            'guidelines' => $data['guidelines'] ?? null,
            'colors' => $data['colors'] ?? [],
            'fonts' => $data['fonts'] ?? [],
            'forbidden_words' => $data['forbidden_words'] ?? [],
            'platforms' => $data['platforms'] ?? [],
        ])->save();

        // Push to the AI memory. The profile is saved here even if this step fails.
        $synced = true;
        $syncError = null;
        try {
            $this->ai->saveProfile($client->company_id, $client->id, [
                'client_name' => $client->name,
                'industry' => (string) $client->industry,
                'brand_tone' => $profile->tone,
                'audience' => $profile->target_audience,
                'platforms' => implode(', ', $profile->platforms ?? []),
                'avoid' => implode(', ', $profile->forbidden_words ?? []),
            ]);
        } catch (RuntimeException $e) {
            $synced = false;
            $syncError = $e->getMessage();
        }

        return response()->json([
            'profile' => $profile,
            'ai_synced' => $synced,
            'ai_error' => $syncError,
        ]);
    }

    /**
     * Read a raw brief (email, notes) and PROPOSE profile fields. Nothing is saved:
     * the employee reviews the fields, then saves them with PUT /clients/{id}/profile.
     * Takes a few seconds (it calls the language model).
     */
    public function extract(Request $request): JsonResponse
    {
        $data = $request->validate(['text' => ['required', 'string', 'min:10', 'max:20000']]);

        try {
            $fields = $this->ai->extractProfile($data['text']);
        } catch (RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 502);
        }

        return response()->json([
            'saved' => false,
            'proposed' => [
                'industry' => $fields['industry'] ?? null,
                'tone' => $fields['brand_tone'] ?? null,
                'target_audience' => $fields['audience'] ?? null,
                'platforms' => $this->toList($fields['platforms'] ?? []),
                'forbidden_words' => $this->toList($fields['avoid'] ?? []),
            ],
            'raw' => $fields,
        ]);
    }

    private function toList(mixed $value): array
    {
        if (is_array($value)) {
            return array_values(array_filter(array_map('trim', array_map('strval', $value))));
        }

        return array_values(array_filter(array_map('trim', preg_split('/[,،\n]+/u', (string) $value))));
    }
}
