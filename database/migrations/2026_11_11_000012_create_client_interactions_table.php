<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('client_interactions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignId('client_id')->constrained('clients')->cascadeOnDelete();
            $table->enum('type', ['meeting', 'message', 'call', 'note']);
            $table->text('summary');
            $table->string('source')->nullable();
            $table->timestamp('occurred_at');
            $table->index(['client_id', 'occurred_at']);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('client_interactions');
    }
};
