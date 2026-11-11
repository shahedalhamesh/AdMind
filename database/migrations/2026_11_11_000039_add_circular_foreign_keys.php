<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('clients', function (Blueprint $table) {
            $table->foreign('responsible_user_id')->references('id')->on('users')->nullOnDelete();
        });

        Schema::table('agent_runs', function (Blueprint $table) {
            $table->foreign('conversation_id')->references('id')->on('conversations')->nullOnDelete();
        });

        Schema::table('content_items', function (Blueprint $table) {
            $table->foreign('current_version_id')->references('id')->on('content_versions')->nullOnDelete();
        });

        Schema::table('sessions', function (Blueprint $table) {
            $table->foreign('user_id')->references('id')->on('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('sessions', function (Blueprint $table) {
            $table->dropForeign(['user_id']);
        });

        Schema::table('content_items', function (Blueprint $table) {
            $table->dropForeign(['current_version_id']);
        });

        Schema::table('agent_runs', function (Blueprint $table) {
            $table->dropForeign(['conversation_id']);
        });

        Schema::table('clients', function (Blueprint $table) {
            $table->dropForeign(['responsible_user_id']);
        });
    }
};
