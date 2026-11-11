<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('approvals', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->string('subject_type'); // content_item, campaign, publish_job...
            $table->unsignedBigInteger('subject_id');
            $table->enum('requested_from_type', ['user', 'client']);
            $table->foreignId('requested_from_id')->constrained('users')->restrictOnDelete();
            $table->enum('reason', ['policy', 'spend_limit', 'sensitive', 'escalation']);
            $table->enum('status', ['pending', 'approved', 'rejected', 'changes_requested']);
            $table->timestamp('decided_at')->nullable();
            $table->text('comment')->nullable();
            $table->timestamp('consolidated_at')->nullable(); // null = not merged into client_rules yet
            $table->index(['company_id', 'status']);
            $table->index(['subject_type', 'subject_id']);
            $table->index(['requested_from_id', 'status']);
            $table->index(['company_id', 'status', 'consolidated_at']);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('approvals');
    }
};
