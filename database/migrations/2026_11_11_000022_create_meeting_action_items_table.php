<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('meeting_action_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignId('meeting_id')->constrained('meetings')->cascadeOnDelete();
            $table->text('description');
            $table->foreignId('suggested_assignee_id')->nullable()->constrained('users')->nullOnDelete();
            $table->date('due_date')->nullable();
            $table->enum('status', ['proposed', 'confirmed', 'rejected']);
            $table->foreignId('task_id')->nullable()->constrained('tasks')->nullOnDelete();
            $table->index(['meeting_id', 'status']);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('meeting_action_items');
    }
};
