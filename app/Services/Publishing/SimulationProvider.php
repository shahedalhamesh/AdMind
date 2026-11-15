<?php

namespace App\Services\Publishing;

use App\Models\PublishJob;

/** Pretends to publish: no platform is contacted. Used for demos and tests. */
class SimulationProvider implements PublishProvider
{
    public function publish(PublishJob $job): array
    {
        return ['external_post_id' => 'sim_'.$job->id.'_'.now()->format('YmdHis')];
    }
}
