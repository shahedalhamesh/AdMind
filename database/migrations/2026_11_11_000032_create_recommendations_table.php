<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('recommendations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignId('client_id')->constrained('clients')->cascadeOnDelete();
            $table->string('subject_type')->nullable();
            $table->unsignedBigInteger('subject_id')->nullable();
            $table->text('recommendation');
            $table->json('based_on');
            $table->enum('status', ['new', 'accepted', 'dismissed']);
            $table->index(['client_id', 'status']);
            $table->index(['subject_type', 'subject_id']);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('recommendations');
    }
};
