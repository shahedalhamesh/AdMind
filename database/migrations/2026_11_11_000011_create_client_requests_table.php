<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('client_requests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignId('client_id')->constrained('clients')->cascadeOnDelete();
            $table->foreignId('submitted_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->enum('type', ['content', 'campaign', 'report', 'complaint', 'other']);
            $table->enum('priority', ['low', 'medium', 'high', 'urgent']);
            $table->string('subject');
            $table->text('description');
            $table->enum('status', ['new', 'in_progress', 'completed', 'rejected']);
            $table->foreignId('task_id')->nullable()->constrained('tasks')->nullOnDelete();
            $table->index(['company_id', 'status', 'priority']);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('client_requests');
    }
};
