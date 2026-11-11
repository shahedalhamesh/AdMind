<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('plans', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('slug')->unique(); // free, pro, agency
            $table->decimal('price_monthly', 10, 2)->default(0);
            $table->unsignedInteger('max_clients')->nullable();
            $table->unsignedInteger('max_users')->nullable();
            $table->unsignedInteger('max_agent_requests_per_day')->nullable();
            $table->json('features');
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('plans');
    }
};
