<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('agent_configs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->enum('agent', ['main', 'client', 'content', 'campaign', 'analytics']);
            $table->boolean('enabled')->default(true);
            $table->string('llm_model');
            $table->json('allowed_tools');
            $table->unsignedInteger('daily_request_limit')->nullable();
            $table->unique(['company_id', 'agent']);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('agent_configs');
    }
};
