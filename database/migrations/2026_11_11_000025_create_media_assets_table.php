<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('media_assets', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignId('client_id')->nullable()->constrained('clients')->cascadeOnDelete();
            $table->enum('type', ['image', 'video', 'audio', 'design']);
            $table->string('path')->nullable(); // null while generating
            $table->enum('source', ['upload', 'ai_generated', 'stock']);
            $table->string('generator')->nullable();
            $table->string('license')->nullable();
            $table->json('metadata')->nullable();
            $table->enum('status', ['pending', 'processing', 'ready', 'failed'])->default('ready');
            $table->text('prompt')->nullable();
            $table->string('provider')->nullable(); // cloudflare, hf-space...
            $table->string('aspect_ratio', 10)->nullable(); // 1:1, 9:16, 16:9
            $table->decimal('duration_seconds', 5, 2)->nullable();
            $table->foreignId('source_media_id')->nullable()->constrained('media_assets')->nullOnDelete();
            $table->foreignId('agent_run_id')->nullable()->constrained('agent_runs')->nullOnDelete();
            $table->text('error')->nullable();
            $table->index(['company_id', 'client_id', 'type']);
            $table->index('status');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('media_assets');
    }
};
