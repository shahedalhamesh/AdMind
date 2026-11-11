<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('content_media', function (Blueprint $table) {
            $table->id();
            $table->foreignId('content_id')->constrained('content_items')->cascadeOnDelete();
            $table->foreignId('media_asset_id')->constrained('media_assets')->cascadeOnDelete();
            $table->unsignedInteger('position')->default(0);
            $table->unique(['content_id', 'media_asset_id']);
            $table->index(['content_id', 'position']);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('content_media');
    }
};
