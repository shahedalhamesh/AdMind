<?php

return [
    /*
     | How scheduled posts are published:
     |  manual     the team posts by hand and records it with "mark published" (default)
     |  simulation the queue worker "publishes" at the scheduled time without contacting any platform
     |  meta       real posting to Instagram and Facebook through the Meta Graph API (not set up yet)
     */
    'provider' => env('PUBLISH_PROVIDER', 'manual'),
];
