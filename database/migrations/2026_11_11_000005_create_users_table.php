<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('users', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->nullable()->constrained('companies')->cascadeOnDelete(); // null = Platform Admin
            $table->foreignId('role_id')->nullable()->constrained('roles')->nullOnDelete();
            $table->foreignId('client_id')->nullable()->constrained('clients')->cascadeOnDelete(); // set for client-type users
            $table->string('name');
            $table->string('email')->unique();
            $table->string('password');
            $table->enum('status', ['active', 'disabled']);
            $table->timestamp('last_login_at')->nullable();
            $table->index(['company_id', 'role_id']);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('users');
    }
};
