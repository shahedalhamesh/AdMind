<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('content_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignId('client_id')->constrained('clients')->cascadeOnDelete();
            $table->foreignId('campaign_id')->nullable()->constrained('campaigns')->nullOnDelete();
            $table->foreignId('task_id')->nullable()->constrained('tasks')->nullOnDelete();
            $table->enum('type', ['post', 'reel', 'video', 'story', 'ad']);
            $table->enum('platform', ['instagram', 'facebook', 'tiktok', 'x', 'linkedin', 'snapchat']);
            $table->string('title');
            $table->enum('status', ['idea', 'draft', 'in_review', 'revision_requested', 'approved', 'scheduled', 'published', 'failed']);
            $table->unsignedBigInteger('current_version_id')->nullable(); // FK to content_versions added in the last migration
            $table->timestamp('scheduled_at')->nullable();
            $table->timestamp('published_at')->nullable();
            $table->enum('created_by_type', ['user', 'agent']);
            $table->unsignedBigInteger('created_by_id')->nullable();
            $table->foreignId('source_run_id')->nullable()->constrained('agent_runs')->nullOnDelete();
            $table->boolean('is_example')->default(false); // approved example (max 30 per client)
            $table->index(['company_id', 'client_id', 'status']);
            $table->index('scheduled_at');
            $table->index(['client_id', 'is_example']);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('content_items');
    }
};
