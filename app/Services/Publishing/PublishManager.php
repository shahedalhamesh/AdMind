<?php

namespace App\Services\Publishing;

/** Picks the provider from config('publishing.provider'). */
class PublishManager
{
    public static function name(): string
    {
        return (string) config('publishing.provider', 'manual');
    }

    /** True when the system posts by itself (simulation or meta). */
    public static function automatic(): bool
    {
        return in_array(self::name(), ['simulation', 'meta'], true);
    }

    public function provider(): PublishProvider
    {
        return match (self::name()) {
            'simulation' => new SimulationProvider(),
            'meta' => new MetaProvider(),
            default => throw new \RuntimeException('Automatic publishing is off (PUBLISH_PROVIDER=manual).'),
        };
    }
}
