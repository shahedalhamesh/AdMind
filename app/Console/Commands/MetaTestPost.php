<?php

namespace App\Console\Commands;

use App\Jobs\PublishPost;
use App\Models\Client;
use App\Models\ContentItem;
use App\Models\ContentVersion;
use App\Models\MediaAsset;
use App\Models\PublishJob;
use App\Models\SocialAccount;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;

/**
 * Creates a ready test post (generated JPEG image + caption + Instagram account + publish job) and queues it.
 * Usage: php artisan meta:test-post {client_id=1}
 * The queue worker must be running with PUBLISH_PROVIDER=meta.
 */
class MetaTestPost extends Command
{
    protected $signature = 'meta:test-post {client_id=1} {--account=nafas_sh8855}';

    protected $description = 'Create a test Instagram post with a generated image and publish it now through the queue';

    public function handle(): int
    {
        if (! function_exists('imagecreatetruecolor')) {
            $this->error('PHP GD extension is not enabled.');

            return self::FAILURE;
        }
        $client = Client::withoutGlobalScopes()->find((int) $this->argument('client_id'));
        if (! $client) {
            $this->error('Client not found.');

            return self::FAILURE;
        }

        // 1. image
        $img = imagecreatetruecolor(1080, 1080);
        for ($y = 0; $y < 1080; $y++) {
            $c = imagecolorallocate($img, 40 + (int) ($y / 12), 90 + (int) ($y / 14), 200 - (int) ($y / 10));
            imageline($img, 0, $y, 1080, $y, $c);
        }
        $white = imagecolorallocate($img, 255, 255, 255);
        imagefilledellipse($img, 540, 540, 420, 420, $white);
        imagestring($img, 5, 470, 530, 'AdMind test post', imagecolorallocate($img, 40, 90, 200));
        ob_start();
        imagejpeg($img, null, 92);
        $bytes = ob_get_clean();

        $path = "media/{$client->company_id}/{$client->id}/".bin2hex(random_bytes(8)).'.jpg';
        Storage::disk('local')->put($path, $bytes);

        $media = MediaAsset::forceCreate([
            'company_id' => $client->company_id, 'client_id' => $client->id, 'type' => 'image', 'path' => $path,
            'source' => 'upload', 'status' => 'ready', 'metadata' => ['original_name' => 'meta-test.jpg', 'mime' => 'image/jpeg'],
        ]);

        // 2. content + version
        $item = ContentItem::forceCreate([
            'company_id' => $client->company_id, 'client_id' => $client->id, 'type' => 'post', 'platform' => 'instagram',
            'title' => 'Meta test post', 'status' => 'scheduled', 'created_by_type' => 'user', 'scheduled_at' => now(),
        ]);
        $version = ContentVersion::forceCreate([
            'company_id' => $client->company_id, 'content_id' => $item->id, 'version_number' => 1, 'language' => 'en',
            'body' => 'Test post sent from AdMind. Ignore it.', 'hashtags' => ['AdMind', 'test'], 'created_by_type' => 'user',
        ]);
        $item->forceFill(['current_version_id' => $version->id])->save();
        $item->mediaAssets()->attach($media->id, ['position' => 0]);

        // 3. account + job
        $account = SocialAccount::withoutGlobalScopes()->where('client_id', $client->id)->where('platform', 'instagram')
            ->where('account_name', $this->option('account'))->first()
            ?? SocialAccount::forceCreate([
                'company_id' => $client->company_id, 'client_id' => $client->id, 'platform' => 'instagram',
                'account_name' => $this->option('account'), 'access_token' => 'manual', 'status' => 'connected',
            ]);

        $job = PublishJob::forceCreate([
            'company_id' => $client->company_id, 'content_id' => $item->id, 'content_version_id' => $version->id,
            'social_account_id' => $account->id, 'scheduled_at' => now(), 'status' => 'pending',
        ]);

        PublishPost::dispatch($job->id, true);

        $this->info("Queued publish job #{$job->id} (content #{$item->id}, media #{$media->id}).");
        $this->line('Watch the queue worker window, then check: php artisan tinker --execute="echo App\Models\PublishJob::withoutGlobalScopes()->find('.$job->id.')->only([\'status\',\'last_error\',\'external_post_id\'])" or the profile on Instagram.');

        return self::SUCCESS;
    }
}
