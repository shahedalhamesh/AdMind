<?php

namespace App\Services;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Response;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use RuntimeException;

/**
 * Talks to the AI service. Every call carries company_id and client_id,
 * so the AI side keeps each company's memory separate.
 */
class AiService
{
    // ------------------------------------------------------------ agents

    /** Conversation turn: the AI service remembers earlier turns of the same conversation_id. */
    public function chat(int $companyId, int $clientId, string $message, ?string $conversationId, string $language): array
    {
        return $this->send('POST', '/chat', [
            'company_id' => $companyId,
            'client_id' => $clientId,
            'message' => $message,
            'conversation_id' => $conversationId,
            'language' => $language,
        ])->json();
    }

    /** One-shot request (no conversation history). */
    public function run(int $companyId, int $clientId, string $request, string $language): array
    {
        return $this->send('POST', '/run', [
            'company_id' => $companyId,
            'client_id' => $clientId,
            'request' => $request,
            'language' => $language,
        ])->json();
    }

    // ----------------------------------------------------------- profile

    /** Create or fully replace the client's profile in the AI memory. */
    public function saveProfile(int $companyId, int $clientId, array $fields): void
    {
        $this->send('PUT', '/profile', ['company_id' => $companyId, 'client_id' => $clientId] + $fields);
    }

    /** Read a raw brief and PROPOSE profile fields (nothing is saved). */
    public function extractProfile(string $text): array
    {
        return $this->send('POST', '/profile/extract', ['text' => $text])->json('profile') ?? [];
    }

    // ---------------------------------------------------------- knowledge

    /** Store a text document. Returns ['doc_id' => ..., 'chunks' => ...]. */
    public function addKnowledge(int $companyId, int $clientId, string $title, string $text): array
    {
        return $this->send('POST', '/knowledge', [
            'company_id' => $companyId,
            'client_id' => $clientId,
            'title' => $title,
            'text' => $text,
        ])->json();
    }

    /** Upload a PDF / DOCX / TXT / MD file. Returns doc_id, chunks, characters, warning, preview. */
    public function uploadKnowledge(int $companyId, int $clientId, string $title, UploadedFile $file): array
    {
        return $this->send('POST', '/knowledge/upload', [
            'company_id' => $companyId,
            'client_id' => $clientId,
            'title' => $title,
        ], $file)->json();
    }

    /** Delete a document (all its chunks). A document that is already gone counts as deleted. */
    public function deleteKnowledge(int $companyId, string $docId): void
    {
        $this->send('DELETE', '/knowledge/' . rawurlencode($docId) . '?' . http_build_query(['company_id' => $companyId]), [], null, [404]);
    }

    // ------------------------------------------------------------- http

    private function send(string $method, string $path, array $payload = [], ?UploadedFile $file = null, array $okStatuses = []): Response
    {
        $key = config('services.ai.key');
        if (! $key) {
            throw new RuntimeException('AI_SERVICE_KEY is not set in the .env file.');
        }

        try {
            $http = Http::baseUrl(rtrim(config('services.ai.url'), '/'))
                ->withHeaders(['X-API-Key' => $key])
                ->acceptJson()
                ->timeout(config('services.ai.timeout'));

            if ($file) {
                $http = $http->attach('file', file_get_contents($file->getRealPath()), $file->getClientOriginalName());
            }

            $response = match ($method) {
                'POST' => $http->post($path, $payload),
                'PUT' => $http->put($path, $payload),
                'DELETE' => $http->delete($path),
            };
        } catch (ConnectionException $e) {
            throw new RuntimeException('Cannot reach the AI service: ' . $e->getMessage());
        }

        if ($response->failed() && ! in_array($response->status(), $okStatuses, true)) {
            $detail = $response->json('detail');
            if (! is_string($detail)) {
                $detail = $response->body();
            }
            throw new RuntimeException('AI service error ' . $response->status() . ': ' . mb_substr($detail, 0, 300));
        }

        return $response;
    }
}
