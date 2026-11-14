<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Client;
use App\Models\KnowledgeItem;
use App\Services\AiService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use RuntimeException;

/**
 * Client documents (price lists, menus, brand books...). The AI service stores the text
 * in its vector database and agents read it as reference; this table keeps the list.
 */
class ClientDocumentController extends Controller
{
    public function __construct(private AiService $ai)
    {
    }

    public function index(int $id): JsonResponse
    {
        $client = Client::findOrFail($id);

        return response()->json(
            KnowledgeItem::where('client_id', $client->id)
                ->whereIn('source_type', ['manual', 'file'])
                ->orderByDesc('id')
                ->get(['id', 'title', 'source_type', 'created_at'])
        );
    }

    /** Send either `text` (JSON) or `file` (multipart: pdf, docx, txt, md up to 10 MB). */
    public function store(Request $request, int $id): JsonResponse
    {
        $client = Client::findOrFail($id);

        $data = $request->validate([
            'title' => ['nullable', 'string', 'max:255'],
            'text' => ['required_without:file', 'nullable', 'string'],
            'file' => ['required_without:text', 'nullable', 'file', 'mimes:pdf,docx,txt,md', 'max:10240'],
        ]);

        try {
            if ($request->hasFile('file')) {
                $file = $request->file('file');
                $title = $data['title'] ?? $file->getClientOriginalName();
                $result = $this->ai->uploadKnowledge($client->company_id, $client->id, $title, $file);
                $type = 'file';
                // The AI service returns only a preview of an uploaded file
                $content = $result['preview'] ?? '';
            } else {
                $title = $data['title'] ?? 'Untitled';
                $result = $this->ai->addKnowledge($client->company_id, $client->id, $title, $data['text']);
                $type = 'manual';
                $content = $data['text'];
            }
        } catch (RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 502);
        }

        $item = KnowledgeItem::forceCreate([
            'company_id' => $client->company_id,
            'client_id' => $client->id,
            'source_type' => $type,
            'title' => $title,
            'content' => $content,
            'tags' => [],
            'embedding_ref' => $result['doc_id'] ?? null,
        ]);

        return response()->json([
            'id' => $item->id,
            'title' => $item->title,
            'source_type' => $type,
            'chunks' => $result['chunks'] ?? null,
            'warning' => $result['warning'] ?? null,
        ], 201);
    }

    public function destroy(int $id, int $documentId): JsonResponse
    {
        $client = Client::findOrFail($id);
        $item = KnowledgeItem::where('client_id', $client->id)->findOrFail($documentId);

        try {
            if ($item->embedding_ref) {
                $this->ai->deleteKnowledge($client->company_id, $item->embedding_ref);
            }
        } catch (RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 502);
        }

        $item->delete();

        return response()->json(['message' => 'Document deleted.']);
    }
}
