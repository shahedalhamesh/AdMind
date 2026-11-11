<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('meetings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignId('client_id')->nullable()->constrained('clients')->cascadeOnDelete();
            $table->string('title');
            $table->timestamp('held_at');
            $table->string('recording_path')->nullable();
            $table->longText('transcript')->nullable();
            $table->text('summary')->nullable();
            $table->json('key_insights')->nullable();
            $table->enum('status', ['uploaded', 'processing', 'summarized', 'failed']);
            $table->index(['company_id', 'client_id', 'held_at']);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('meetings');
    }
};
