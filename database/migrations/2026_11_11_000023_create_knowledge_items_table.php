<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('knowledge_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignId('client_id')->nullable()->constrained('clients')->cascadeOnDelete();
            $table->enum('source_type', ['meeting', 'conversation', 'file', 'manual']);
            $table->unsignedBigInteger('source_id')->nullable();
            $table->string('title');
            $table->longText('content');
            $table->json('tags');
            $table->timestamp('last_verified_at')->nullable();
            $table->string('embedding_ref')->nullable(); // id in the vector store
            $table->index(['company_id', 'client_id', 'source_type']);
            $table->index('embedding_ref');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('knowledge_items');
    }
};
