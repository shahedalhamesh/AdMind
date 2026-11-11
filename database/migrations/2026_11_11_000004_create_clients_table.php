<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('clients', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->string('name');
            $table->string('industry')->nullable();
            $table->string('contact_name')->nullable();
            $table->string('contact_email')->nullable();
            $table->string('contact_phone')->nullable();
            $table->text('goals')->nullable();
            $table->json('agreed_services');
            $table->unsignedBigInteger('responsible_user_id')->nullable(); // FK to users added in the last migration
            $table->enum('status', ['active', 'paused', 'churned']);
            $table->softDeletes();
            $table->index(['company_id', 'status']);
            $table->index('responsible_user_id');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('clients');
    }
};
