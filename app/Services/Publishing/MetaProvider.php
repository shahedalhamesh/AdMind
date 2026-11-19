<?php

namespace App\Services\Publishing;

use App\Models\PublishJob;
use Illuminate\Support\Facades\Http;
use RuntimeException;

/**
 * Real posting to Instagram through the Instagram API (content publishing):
 *   1. create a media container (image / reel / story / carousel) from a public URL,
 *   2. wait until Instagram has processed it (video only),
 *   3. publish the container.
 * Facebook Pages are not connected yet, so a Facebook job fails with a clear message.
 */
class MetaProvider implements PublishProvider
{
    public function publish(PublishJob $job): array
    {
        $cfg = config('publishing.meta');
        foreach (['ig_user_id' => 'META_IG_USER_ID', 'access_token' => 'META_IG_ACCESS_TOKEN', 'public_base_url' => 'META_PUBLIC_BASE_URL'] as $key => $env) {
            if (empty($cfg[$key])) {
                throw new RuntimeException("Meta is not configured: {$env} is missing in .env.");
            }
        }

        $content = $job->content()->withoutGlobalScopes()->firstOrFail();
        if ($content->platform !== 'instagram') {
            throw new RuntimeException("Real posting is only set up for Instagram (this post is for {$content->platform}).");
        }

        $version = $job->contentVersion()->withoutGlobalScopes()->first();
        $caption = $this->caption($version?->body, $version?->hashtags);

        $media = $content->mediaAssets()->withoutGlobalScopes()->where('media_assets.status', 'ready')
            ->whereIn('media_assets.type', ['image', 'video'])->get()
            ->filter(fn ($m) => $m->path);
        if ($media->isEmpty()) {
            throw new RuntimeException('This post has no image or video. Instagram needs media to publish.');
        }

        $containerId = $this->createContainer($content->type, $media, $caption, $cfg);

        $res = $this->call('post', "{$cfg['ig_user_id']}/media_publish", ['creation_id' => $containerId], $cfg);

        return ['external_post_id' => (string) $res['id']];
    }

    private function createContainer(string $type, $media, string $caption, array $cfg): string
    {
        $first = $media->first();
        $isVideo = $first->type === 'video';

        // Several images: a carousel.
        if ($media->count() > 1 && $media->every(fn ($m) => $m->type === 'image') && $type === 'post') {
            $children = [];
            foreach ($media->take(10) as $m) {
                $r = $this->call('post', "{$cfg['ig_user_id']}/media", [
                    'image_url' => $this->url($m->id, 'jpg', $cfg), 'is_carousel_item' => 'true',
                ], $cfg);
                $children[] = $r['id'];
            }
            $r = $this->call('post', "{$cfg['ig_user_id']}/media", [
                'media_type' => 'CAROUSEL', 'children' => implode(',', $children), 'caption' => $caption,
            ], $cfg);

            return $r['id'];
        }

        $params = [];
        if ($type === 'story') {
            $params['media_type'] = 'STORIES';
            $params[$isVideo ? 'video_url' : 'image_url'] = $this->url($first->id, $isVideo ? 'mp4' : 'jpg', $cfg);
        } elseif ($isVideo) {
            // Instagram no longer accepts plain "VIDEO"; every feed video is published as a reel.
            $params = ['media_type' => 'REELS', 'video_url' => $this->url($first->id, 'mp4', $cfg), 'caption' => $caption];
        } else {
            $params = ['image_url' => $this->url($first->id, 'jpg', $cfg), 'caption' => $caption];
        }
        if ($type !== 'story') {
            $params['caption'] = $caption;
        }

        $r = $this->call('post', "{$cfg['ig_user_id']}/media", $params, $cfg);
        $id = $r['id'];

        if ($isVideo) {
            $this->waitUntilReady($id, $cfg);
        }

        return $id;
    }

    private function waitUntilReady(string $containerId, array $cfg): void
    {
        $deadline = time() + (int) $cfg['video_wait_seconds'];
        do {
            sleep(5);
            $s = $this->call('get', $containerId, ['fields' => 'status_code,status'], $cfg);
            $code = $s['status_code'] ?? '';
            if ($code === 'FINISHED') {
                return;
            }
            if (in_array($code, ['ERROR', 'EXPIRED'], true)) {
                throw new RuntimeException('Instagram could not process the video: '.($s['status'] ?? $code));
            }
        } while (time() < $deadline);

        throw new RuntimeException('Instagram took too long to process the video.');
    }

    private function caption(?string $body, $hashtags): string
    {
        if (is_string($hashtags)) {
            $hashtags = json_decode($hashtags, true) ?: [];
        }
        $tags = collect(is_array($hashtags) ? $hashtags : [])
            ->map(fn ($t) => '#'.ltrim(trim((string) $t), '#'))->filter(fn ($t) => $t !== '#')->implode(' ');

        return mb_substr(trim(trim((string) $body)."\n\n".$tags), 0, 2200);
    }

    /** A temporary public link for one media file (HMAC-signed, no login needed). */
    private function url(int $mediaId, string $ext, array $cfg): string
    {
        $exp = time() + 60 * (int) $cfg['media_link_minutes'];
        $sig = self::sign($mediaId, $exp);

        return rtrim($cfg['public_base_url'], '/')."/api/public-media/{$mediaId}/{$exp}/{$sig}/file.{$ext}";
    }

    public static function sign(int $mediaId, int $exp): string
    {
        return hash_hmac('sha256', "media|{$mediaId}|{$exp}", (string) config('app.key'));
    }

    private function call(string $method, string $path, array $params, array $cfg): array
    {
        $url = rtrim($cfg['graph_host'], '/')."/{$cfg['graph_version']}/".ltrim($path, '/');
        $params['access_token'] = $cfg['access_token'];

        $response = $method === 'get'
            ? Http::timeout(60)->get($url, $params)
            : Http::timeout(60)->asForm()->post($url, $params);

        if ($response->failed()) {
            $msg = $response->json('error.message') ?? $response->body();
            // Never leak the token into logs or the failure notification.
            throw new RuntimeException('Instagram: '.str_replace((string) $cfg['access_token'], '***', mb_substr((string) $msg, 0, 400)));
        }

        return $response->json() ?? [];
    }
}
