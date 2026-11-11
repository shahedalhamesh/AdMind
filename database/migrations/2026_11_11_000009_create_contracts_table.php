<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('contracts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignId('client_id')->constrained('clients')->cascadeOnDelete();
            $table->string('service');
            $table->date('starts_on');
            $table->date('ends_on')->nullable();
            $table->date('renewal_date')->nullable();
            $table->decimal('amount', 12, 2)->nullable();
            $table->enum('status', ['active', 'expiring', 'expired', 'cancelled']);
            $table->index(['company_id', 'renewal_date']);
            $table->index(['client_id', 'status']);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('contracts');
    }
};
