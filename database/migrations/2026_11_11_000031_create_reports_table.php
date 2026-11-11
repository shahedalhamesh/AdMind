<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('reports', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignId('client_id')->nullable()->constrained('clients')->cascadeOnDelete();
            $table->enum('type', ['client', 'company', 'agent_efficiency', 'costs']);
            $table->date('period_start');
            $table->date('period_end');
            $table->json('data');
            $table->boolean('visible_to_client')->default(false);
            $table->string('generated_by'); // agent or user
            $table->timestamp('generated_at');
            $table->index(['company_id', 'client_id', 'type', 'period_start']);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('reports');
    }
};
