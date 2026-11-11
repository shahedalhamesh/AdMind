<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('publish_jobs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignId('content_id')->constrained('content_items')->cascadeOnDelete();
            $table->foreignId('content_version_id')->constrained('content_versions')->restrictOnDelete();
            $table->foreignId('social_account_id')->constrained('social_accounts')->cascadeOnDelete();
            $table->timestamp('scheduled_at');
            $table->enum('status', ['pending', 'publishing', 'published', 'failed', 'cancelled']);
            $table->unsignedTinyInteger('attempts')->default(0);
            $table->text('last_error')->nullable();
            $table->string('external_post_id')->nullable();
            $table->timestamp('published_at')->nullable();
            $table->index(['status', 'scheduled_at']);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('publish_jobs');
    }
};
