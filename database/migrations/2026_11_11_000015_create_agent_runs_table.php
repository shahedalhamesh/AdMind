<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('agent_runs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignId('task_id')->nullable()->constrained('tasks')->nullOnDelete();
            $table->unsignedBigInteger('conversation_id')->nullable(); // FK to conversations added in the last migration
            $table->foreignId('client_id')->nullable()->constrained('clients')->cascadeOnDelete();
            $table->string('agent'); // main, content, campaign...
            $table->enum('status', ['running', 'succeeded', 'failed']);
            $table->json('input');
            $table->longText('output')->nullable();
            $table->timestamp('started_at');
            $table->timestamp('finished_at')->nullable();
            $table->unsignedInteger('input_tokens')->default(0);
            $table->unsignedInteger('output_tokens')->default(0);
            $table->decimal('cost', 10, 4)->default(0);
            $table->text('error')->nullable();
            $table->enum('verification_status', ['ok', 'corrected', 'skipped', 'failed'])->nullable();
            $table->longText('original_output')->nullable();
            $table->index(['company_id', 'agent', 'status']);
            $table->index(['client_id', 'started_at']);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('agent_runs');
    }
};
