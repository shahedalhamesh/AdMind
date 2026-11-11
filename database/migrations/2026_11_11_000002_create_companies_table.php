<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('companies', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('plan'); // free / pro / agency
            $table->foreignId('plan_id')->nullable()->constrained('plans')->nullOnDelete();
            $table->enum('subscription_status', ['trial', 'active', 'suspended', 'cancelled']);
            $table->timestamp('subscription_ends_at')->nullable();
            $table->json('features');
            $table->text('business_goals')->nullable();
            $table->text('company_identity')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('companies');
    }
};
