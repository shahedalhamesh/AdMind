<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Jobs\GenerateMedia;
use App\Models\Client;
use App\Models\ContentItem;
use App\Models\MediaAsset;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\URL;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

/**
 * Images, videos and audio files of a client (library), and their use in content items.
 * Files are private: every media item comes with a `url` that is signed and valid for 2 hours,
 * so it works in <img>, <video> and <audio> tags without an Authorization header.
 */
class MediaController extends Controller
{
    private const EXT = [
        'image' => ['jpg', 'jpeg', 'png', 'webp', 'gif'],
        'video' => ['mp4', 'mov', 'webm'],
        'audio' => ['mp3', 'wav', 'm4a', 'ogg', 'aac'],
    ];

    /** Filters: client_id (required), type (image|video|audio), per_page (max 100). */
    public function index(Request $request): JsonResponse
    {
        $request->validate(['client_id' => ['required', 'integer']]);
        $client = Client::findOrFail($request->query('client_id'));

        $query = MediaAsset::where('client_id', $client->id)->orderByDesc('id');
        if ($request->filled('type')) {
            $query->where('type', $request->query('type'));
        }
        $page = $query->paginate(min((int) $request->query('per_page', 24), 100));
        $page->getCollection()->transform(fn ($m) => $this->present($m));

        return response()->json($page);
    }

    public function show(int $id): JsonResponse
    {
        return response()->json($this->present(MediaAsset::findOrFail($id)));
    }

    /**
     * Upload one file (multipart/form-data): file, client_id, optional content_id (attach it right away).
     * Images jpg, png, webp, gif; videos mp4, mov, webm; audio mp3, wav, m4a, ogg, aac. Max 50 MB.
     */
    public function store(Request $request): JsonResponse
    {
        $all = array_merge(...array_values(self::EXT));
        $data = $request->validate([
            'client_id' => ['required', 'integer'],
            'content_id' => ['nullable', 'integer'],
            'file' => ['required', 'file', 'max:51200', 'mimes:' . implode(',', $all)],
        ]);
        $client = Client::findOrFail($data['client_id']);
        $item = null;
        if (! empty($data['content_id'])) {
            $item = ContentItem::where('client_id', $client->id)->findOrFail($data['content_id']);
        }

        $file = $request->file('file');
        $ext = strtolower($file->getClientOriginalExtension() ?: $file->guessExtension());
        $type = collect(self::EXT)->search(fn ($list) => in_array($ext, $list, true)) ?: 'image';

        $path = Storage::disk('local')->putFileAs(
            "media/{$client->company_id}/{$client->id}", $file, bin2hex(random_bytes(8)) . ".{$ext}"
        );

        $media = MediaAsset::forceCreate([
            'company_id' => $client->company_id,
            'client_id' => $client->id,
            'type' => $type,
            'path' => $path,
            'source' => 'upload',
            'status' => 'ready',
            'metadata' => [
                'original_name' => $file->getClientOriginalName(),
                'mime' => $file->getClientMimeType(),
                'size' => $file->getSize(),
                'uploaded_by' => $request->user()->id,
            ],
        ]);
        if ($item) {
            $this->attachTo($item, $media);
        }

        return response()->json($this->present($media), 201);
    }

    /**
     * Ask the AI to create an image or a reel. Body: client_id, kind (image|reel), request (the employee's own
     * words, any language), aspect_ratio (default 1:1 for images, 9:16 for reels), language (reel voiceover,
     * default Arabic), content_id (optional: attach it when ready).
     * Returns 202 + the media item (status processing). Poll GET /media/{id} until ready or failed.
     * The AI service builds one thing at a time, so a second request is refused while one is running.
     */
    public function generate(Request $request): JsonResponse
    {
        $data = $request->validate([
            'client_id' => ['required', 'integer'],
            'kind' => ['required', 'in:image,reel'],
            'request' => ['required', 'string', 'min:3', 'max:2000'],
            'aspect_ratio' => ['nullable', 'in:1:1,16:9,9:16,4:3,3:4'],
            'language' => ['nullable', 'in:Arabic,English'],
            'content_id' => ['nullable', 'integer'],
        ]);
        $client = Client::findOrFail($data['client_id']);
        if (! empty($data['content_id'])) {
            ContentItem::where('client_id', $client->id)->findOrFail($data['content_id']);
        }

        $busy = MediaAsset::withoutGlobalScopes()->where('source', 'ai_generated')->where('status', 'processing')
            ->where('updated_at', '>', now()->subMinutes(20))->exists();
        abort_if($busy, 429, 'The AI is already creating a file. Try again in a few minutes.');

        $aspect = $data['aspect_ratio'] ?? ($data['kind'] === 'reel' ? '9:16' : '1:1');
        $media = MediaAsset::forceCreate([
            'company_id' => $client->company_id,
            'client_id' => $client->id,
            'type' => $data['kind'] === 'reel' ? 'video' : 'image',
            'path' => null,
            'source' => 'ai_generated',
            'generator' => 'ai-service',
            'provider' => 'ai-service',
            'prompt' => $data['request'],
            'aspect_ratio' => $aspect,
            'status' => 'processing',
            'metadata' => ['kind' => $data['kind'], 'step' => 'queued', 'requested_by' => $request->user()->id],
        ]);

        GenerateMedia::dispatch($media->id, $data['kind'], $data['language'] ?? 'Arabic', $data['content_id'] ?? null);

        return response()->json($this->present($media), 202);
    }

    /** Delete the file and remove it from every content item. */
    public function destroy(int $id): JsonResponse
    {
        $media = MediaAsset::findOrFail($id);
        abort_if($media->status === 'processing', 422, 'The AI is still creating this file.');
        $used = $media->contentItems()->whereIn('status', ['scheduled', 'published'])->exists();
        abort_if($used, 422, 'This file is used by scheduled or published content.');

        if ($media->path) {
            Storage::disk('local')->delete($media->path);
        }
        $media->delete();

        return response()->json(['message' => 'Media deleted.']);
    }

    /** The signed link target: streams the file (supports Range, so videos can seek). */
    public function file(int $id): BinaryFileResponse
    {
        $media = MediaAsset::withoutGlobalScopes()->findOrFail($id);
        abort_unless($media->path && Storage::disk('local')->exists($media->path), 404);

        return response()->file(Storage::disk('local')->path($media->path));
    }

    // ---------------------------------------------------- media of a content item

    public function forContent(Request $request, int $id): JsonResponse
    {
        $item = $this->visibleItem($request, $id);

        return response()->json($item->mediaAssets->map(fn ($m) => $this->present($m))->values());
    }

    /** Body: media_id, position (optional). Same client only. */
    public function attach(Request $request, int $id): JsonResponse
    {
        $item = ContentItem::findOrFail($id);
        $data = $request->validate([
            'media_id' => ['required', 'integer'],
            'position' => ['nullable', 'integer', 'min:0', 'max:100'],
        ]);
        $media = MediaAsset::where('client_id', $item->client_id)->findOrFail($data['media_id']);
        $this->attachTo($item, $media, $data['position'] ?? null);

        return response()->json($item->fresh()->mediaAssets->map(fn ($m) => $this->present($m))->values());
    }

    public function detach(int $id, int $mediaId): JsonResponse
    {
        $item = ContentItem::findOrFail($id);
        $item->mediaAssets()->detach($mediaId);

        return response()->json($item->fresh()->mediaAssets->map(fn ($m) => $this->present($m))->values());
    }

    // ------------------------------------------------------------ helpers

    private function attachTo(ContentItem $item, MediaAsset $media, ?int $position = null): void
    {
        $position ??= (int) $item->mediaAssets()->count();
        $item->mediaAssets()->syncWithoutDetaching([$media->id => ['position' => $position]]);
    }

    /** A client's own login only sees the content of its client, never ideas or drafts. */
    private function visibleItem(Request $request, int $id): ContentItem
    {
        $query = ContentItem::query();
        $user = $request->user();
        if ($user->client_id) {
            $query->where('client_id', $user->client_id)->whereNotIn('status', ['idea', 'draft']);
        }

        return $query->findOrFail($id);
    }

    private function present(MediaAsset $media): array
    {
        $out = $media->toArray();
        $out['url'] = $media->path
            ? URL::temporarySignedRoute('media.file', now()->addHours(2), ['id' => $media->id])
            : null;
        unset($out['path']);

        return $out;
    }
}
