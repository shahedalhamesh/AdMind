<?php

return [
    /*
     | How scheduled posts are published:
     |  manual     the team posts by hand and records it with "mark published" (default)
     |  simulation the queue worker "publishes" at the scheduled time without contacting any platform
     |  meta       real posting to Instagram through the Instagram API (Graph API)
     */
    'provider' => env('PUBLISH_PROVIDER', 'manual'),

    'meta' => [
        // Instagram professional account id and its long-lived access token (kept in .env only).
        'ig_user_id' => env('META_IG_USER_ID'),
        'access_token' => env('META_IG_ACCESS_TOKEN'),
        'graph_version' => env('META_GRAPH_VERSION', 'v21.0'),
        'graph_host' => env('META_GRAPH_HOST', 'https://graph.instagram.com'),
        // Public HTTPS address of this backend (an ngrok / Cloudflare tunnel in development).
        // Instagram downloads the image or video from here, so it must be reachable from the internet.
        'public_base_url' => env('META_PUBLIC_BASE_URL'),
        'media_link_minutes' => 60,
        'video_wait_seconds' => 300,
    ],
];
