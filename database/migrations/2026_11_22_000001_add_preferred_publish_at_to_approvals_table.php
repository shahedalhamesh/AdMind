<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('approvals', function (Blueprint $table) {
            // the time the client would like the post to go out (a wish, set with the approval)
            $table->timestamp('preferred_publish_at')->nullable()->after('decided_at');
        });
    }

    public function down(): void
    {
        Schema::table('approvals', function (Blueprint $table) {
            $table->dropColumn('preferred_publish_at');
        });
    }
};
