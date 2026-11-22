<?php

namespace App\Console\Commands;

use App\Services\StuckWork;
use Illuminate\Console\Command;

/**
 * php artisan ai:fail-stuck
 * Marks AI runs and AI media that stayed running too long as failed (all companies).
 */
class FailStuckWork extends Command
{
    protected $signature = 'ai:fail-stuck {--runs=10 : minutes for agent runs} {--media=16 : minutes for AI media}';

    protected $description = 'Mark stuck AI runs and AI media as failed';

    public function handle(): int
    {
        $r = StuckWork::sweep((int) $this->option('runs'), (int) $this->option('media'));
        $this->info("Failed {$r['runs']} agent run(s) and {$r['media']} media item(s).");

        return self::SUCCESS;
    }
}
