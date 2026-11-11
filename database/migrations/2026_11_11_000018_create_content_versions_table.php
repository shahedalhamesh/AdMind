<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('content_versions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignId('content_id')->constrained('content_items')->cascadeOnDelete();
            $table->unsignedInteger('version_number');
            $table->enum('language', ['ar', 'en']);
            $table->longText('body');
            $table->json('hashtags')->nullable();
            $table->longText('script')->nullable();
            $table->text('instruction')->nullable();
            $table->enum('created_by_type', ['user', 'agent']);
            $table->unsignedBigInteger('created_by_id')->nullable();
            $table->foreignId('agent_run_id')->nullable()->constrained('agent_runs')->nullOnDelete();
            $table->unique(['content_id', 'version_number']);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('content_versions');
    }
};
