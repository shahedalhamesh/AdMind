<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('brand_identities', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignId('client_id')->constrained('clients')->cascadeOnDelete();
            $table->string('tone');
            $table->json('colors');
            $table->json('fonts');
            $table->text('target_audience');
            $table->text('content_style');
            $table->text('guidelines')->nullable();
            $table->json('forbidden_words');
            $table->json('platforms')->nullable();
            $table->unique('client_id');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('brand_identities');
    }
};
