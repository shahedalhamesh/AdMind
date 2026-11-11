<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('performance_metrics', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignId('client_id')->constrained('clients')->cascadeOnDelete();
            $table->enum('subject_type', ['content', 'campaign', 'account']);
            $table->unsignedBigInteger('subject_id');
            $table->string('platform');
            $table->string('metric'); // reach, likes, ctr, spend...
            $table->decimal('value', 18, 4);
            $table->date('metric_date');
            $table->timestamp('collected_at');
            $table->boolean('is_stale')->default(false);
            $table->unique(['company_id', 'subject_type', 'subject_id', 'platform', 'metric', 'metric_date'], 'perf_metrics_unique');
            $table->index(['client_id', 'metric_date']);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('performance_metrics');
    }
};
