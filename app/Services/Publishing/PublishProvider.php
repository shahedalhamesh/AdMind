<?php

namespace App\Services\Publishing;

use App\Models\PublishJob;

interface PublishProvider
{
    /**
     * Publish the job's content version on its social account.
     * Returns ['external_post_id' => string]. Throws an exception when it fails.
     */
    public function publish(PublishJob $job): array;
}
