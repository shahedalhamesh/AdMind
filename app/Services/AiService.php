<?php

namespace App\Services;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;
use RuntimeException;

/**
 * Talks to the AI service. Every call carries company_id and client_id,
 * so the AI side keeps each company's memory separate.
 */
class AiService
{
    /** Conversation turn: the AI service remembers earlier turns of the same conversation_id. */
    public function chat(int $companyId, int $clientId, string $message, ?string $conversationId, string $language): array
    {
        return $this->post('/chat', [
            'company_id' => $companyId,
            'client_id' => $clientId,
            'message' => $message,
            'conversation_id' => $conversationId,
            'language' => $language,
        ]);
    }

    /** One-shot request (no conversation history). */
    public function run(int $companyId, int $clientId, string $request, string $language): array
    {
        return $this->post('/run', [
            'company_id' => $companyId,
            'client_id' => $clientId,
            'request' => $request,
            'language' => $language,
        ]);
    }

    private function post(string $path, array $payload): array
    {
        $key = config('services.ai.key');
        if (! $key) {
            throw new RuntimeException('AI_SERVICE_KEY is not set in the .env file.');
        }

        try {
            $response = Http::baseUrl(rtrim(config('services.ai.url'), '/'))
                ->withHeaders(['X-API-Key' => $key])
                ->acceptJson()
                ->timeout(config('services.ai.timeout'))
                ->post($path, $payload);
        } catch (ConnectionException $e) {
            throw new RuntimeException('Cannot reach the AI service: ' . $e->getMessage());
        }

        if ($response->failed()) {
            $detail = $response->json('detail');
            if (! is_string($detail)) {
                $detail = $response->body();
            }
            throw new RuntimeException('AI service error ' . $response->status() . ': ' . mb_substr($detail, 0, 300));
        }

        return $response->json();
    }
}
