<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('agent_run_steps', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignId('agent_run_id')->constrained('agent_runs')->cascadeOnDelete();
            $table->unsignedSmallInteger('step_order');
            $table->string('agent');
            $table->string('delegated_by')->nullable();
            $table->string('action');
            $table->json('input')->nullable();
            $table->longText('output')->nullable();
            $table->enum('status', ['running', 'succeeded', 'failed']);
            $table->timestamp('started_at');
            $table->timestamp('finished_at')->nullable();
            $table->text('error')->nullable();
            $table->index(['agent_run_id', 'step_order']);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('agent_run_steps');
    }
};
