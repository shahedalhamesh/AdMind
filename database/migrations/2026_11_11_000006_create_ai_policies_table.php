<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ai_policies', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignId('client_id')->nullable()->constrained('clients')->cascadeOnDelete(); // null = company default
            $table->enum('autonomy_level', ['manual', 'assisted', 'autonomous']);
            $table->decimal('max_spend', 12, 2)->nullable();
            $table->json('approval_rules');
            $table->json('publish_rules');
            $table->foreignId('escalate_to_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->unique(['company_id', 'client_id']);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ai_policies');
    }
};
