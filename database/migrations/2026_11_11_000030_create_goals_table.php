<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('goals', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignId('client_id')->constrained('clients')->cascadeOnDelete();
            $table->string('metric');
            $table->decimal('target_value', 18, 4);
            $table->enum('period', ['weekly', 'monthly', 'quarterly']);
            $table->date('starts_on');
            $table->date('ends_on');
            $table->enum('status', ['on_track', 'at_risk', 'missed', 'achieved']);
            $table->index(['client_id', 'status']);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('goals');
    }
};
