<?php

namespace App\Services\Publishing;

use App\Models\PublishJob;
use RuntimeException;

/** Real posting through the Meta Graph API. Placeholder until the Meta developer app is ready. */
class MetaProvider implements PublishProvider
{
    public function publish(PublishJob $job): array
    {
        throw new RuntimeException('The Meta provider is not set up yet.');
    }
}
