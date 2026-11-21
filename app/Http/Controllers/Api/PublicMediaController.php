<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\MediaAsset;
use App\Services\Publishing\MetaProvider;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\Response;

/**
 * Serves one media file to Instagram (which downloads it from a public URL when publishing).
 * No login: the link carries an expiry time and an HMAC signature made with the app key, so it cannot be guessed.
 * Images are sent as JPEG, because Instagram only accepts JPEG.
 */
class PublicMediaController extends Controller
{
    public function show(int $id, int $exp, string $sig, string $file): Response
    {
        abort_unless($exp >= time() && hash_equals(MetaProvider::sign($id, $exp), $sig), 403);

        $media = MediaAsset::withoutGlobalScopes()->find($id);
        abort_unless($media && $media->path && Storage::disk('local')->exists($media->path), 404);

        $full = Storage::disk('local')->path($media->path);

        if ($media->type === 'video') {
            // the copy converted for Instagram (30 FPS) when it exists
            $ready = Storage::disk('local')->path("ig-ready/{$media->id}.mp4");

            return response()->file(is_file($ready) ? $ready : $full, ['Content-Type' => 'video/mp4']);
        }

        $ext = strtolower(pathinfo($full, PATHINFO_EXTENSION));
        if (in_array($ext, ['jpg', 'jpeg'], true)) {
            return response()->file($full, ['Content-Type' => 'image/jpeg']);
        }

        $img = match ($ext) {
            'png' => @imagecreatefrompng($full),
            'webp' => function_exists('imagecreatefromwebp') ? @imagecreatefromwebp($full) : false,
            'gif' => @imagecreatefromgif($full),
            default => false,
        };
        abort_unless($img, 415, 'This image type cannot be converted to JPEG.');

        // Flatten transparency onto white.
        $w = imagesx($img);
        $h = imagesy($img);
        $canvas = imagecreatetruecolor($w, $h);
        imagefill($canvas, 0, 0, imagecolorallocate($canvas, 255, 255, 255));
        imagecopy($canvas, $img, 0, 0, 0, 0, $w, $h);

        ob_start();
        imagejpeg($canvas, null, 92);
        $bytes = ob_get_clean();

        return response($bytes, 200, ['Content-Type' => 'image/jpeg']);
    }
}
