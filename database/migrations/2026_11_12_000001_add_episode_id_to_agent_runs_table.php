<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('agent_runs', function (Blueprint $table) {
            // id of this exchange in the AI service memory: needed to send feedback about it
            $table->unsignedBigInteger('episode_id')->nullable()->after('conversation_id');
        });
    }

    public function down(): void
    {
        Schema::table('agent_runs', function (Blueprint $table) {
            $table->dropColumn('episode_id');
        });
    }
};
