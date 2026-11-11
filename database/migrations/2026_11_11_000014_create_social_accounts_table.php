<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('social_accounts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignId('client_id')->constrained('clients')->cascadeOnDelete();
            $table->enum('platform', ['instagram', 'facebook', 'tiktok', 'x', 'linkedin', 'snapchat']);
            $table->string('account_name');
            $table->text('access_token'); // encrypted (cast in the model)
            $table->text('refresh_token')->nullable(); // encrypted (cast in the model)
            $table->timestamp('token_expires_at')->nullable();
            $table->enum('status', ['connected', 'expired', 'error']);
            $table->unique(['client_id', 'platform', 'account_name']);
            $table->index(['status', 'token_expires_at']);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('social_accounts');
    }
};
