<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tasks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignId('client_id')->nullable()->constrained('clients')->cascadeOnDelete();
            $table->foreignId('parent_task_id')->nullable()->constrained('tasks')->cascadeOnDelete();
            $table->string('title');
            $table->text('description')->nullable();
            $table->string('type'); // content, campaign, report, review...
            $table->enum('source', ['manager', 'client_request', 'meeting', 'agent', 'system']);
            $table->enum('assignee_type', ['user', 'agent']);
            $table->foreignId('assignee_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('assignee_agent')->nullable();
            $table->enum('priority', ['low', 'medium', 'high', 'urgent']);
            $table->enum('status', ['new', 'in_progress', 'waiting_info', 'waiting_approval', 'completed', 'failed']);
            $table->timestamp('due_at')->nullable();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->enum('created_by_type', ['user', 'agent', 'system']);
            $table->unsignedBigInteger('created_by_id')->nullable();
            $table->index(['company_id', 'status', 'due_at']);
            $table->index(['assignee_user_id', 'status']);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tasks');
    }
};
