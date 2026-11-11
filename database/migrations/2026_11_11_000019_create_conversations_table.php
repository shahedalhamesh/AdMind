<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('conversations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->enum('scope', ['main_agent', 'task', 'content']);
            $table->foreignId('user_id')->constrained('users')->restrictOnDelete();
            $table->foreignId('client_id')->nullable()->constrained('clients')->cascadeOnDelete();
            $table->foreignId('task_id')->nullable()->constrained('tasks')->nullOnDelete();
            $table->foreignId('content_id')->nullable()->constrained('content_items')->nullOnDelete();
            $table->string('agent')->nullable();
            $table->string('title')->nullable();
            $table->index(['company_id', 'scope', 'user_id']);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('conversations');
    }
};
