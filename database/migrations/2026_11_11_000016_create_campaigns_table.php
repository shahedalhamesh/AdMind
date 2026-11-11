<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('campaigns', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignId('client_id')->constrained('clients')->cascadeOnDelete();
            $table->string('name');
            $table->string('objective');
            $table->decimal('budget', 12, 2);
            $table->decimal('spent', 12, 2)->default(0);
            $table->string('currency', 3);
            $table->json('channels');
            $table->json('audience')->nullable();
            $table->date('starts_on')->nullable();
            $table->date('ends_on')->nullable();
            $table->enum('status', ['draft', 'planned', 'active', 'paused', 'completed']);
            $table->json('plan');
            $table->index(['company_id', 'client_id', 'status']);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('campaigns');
    }
};
