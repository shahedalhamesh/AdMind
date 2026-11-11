<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('audit_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->enum('actor_type', ['user', 'agent', 'system']);
            $table->foreignId('actor_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('actor_agent')->nullable();
            $table->string('action'); // instruction, edit, approve, publish, permission_change
            $table->string('subject_type');
            $table->unsignedBigInteger('subject_id')->nullable();
            $table->json('changes')->nullable(); // before and after
            $table->enum('result', ['success', 'denied', 'failed']);
            $table->string('ip_address')->nullable();
            $table->index(['company_id', 'created_at']);
            $table->index(['subject_type', 'subject_id']);
            $table->index(['actor_type', 'actor_id']);
            $table->timestamp('created_at')->useCurrent();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('audit_logs');
    }
};
