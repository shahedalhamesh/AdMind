<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('client_rules', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignId('client_id')->constrained('clients')->cascadeOnDelete();
            $table->text('rule'); // one rule per row (max 8 per client)
            $table->unsignedTinyInteger('position')->default(0);
            $table->enum('source', ['consolidated', 'manual']);
            $table->enum('status', ['active', 'archived'])->default('active');
            $table->timestamp('last_consolidated_at')->nullable();
            $table->index(['company_id', 'client_id', 'status']);
            $table->index(['client_id', 'position']);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('client_rules');
    }
};
