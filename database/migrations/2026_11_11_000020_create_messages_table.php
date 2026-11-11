<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('messages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignId('conversation_id')->constrained('conversations')->cascadeOnDelete();
            $table->enum('sender_type', ['user', 'client', 'agent', 'system']);
            $table->foreignId('sender_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('sender_agent')->nullable();
            $table->text('content');
            $table->json('meta')->nullable();
            $table->index(['conversation_id', 'created_at']);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('messages');
    }
};
