<?php

namespace App\Models;

use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class MediaAsset extends Model
{
    use BelongsToCompany;

    protected $table = 'media_assets';

    protected $guarded = ['id', 'company_id'];

    protected $casts = [
        'metadata' => 'array',
        'duration_seconds' => 'decimal:2',
    ];

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class, 'company_id');
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class, 'client_id');
    }

    public function sourceMedia(): BelongsTo
    {
        return $this->belongsTo(MediaAsset::class, 'source_media_id');
    }

    public function agentRun(): BelongsTo
    {
        return $this->belongsTo(AgentRun::class, 'agent_run_id');
    }

    public function derivedMedia(): HasMany
    {
        return $this->hasMany(MediaAsset::class, 'source_media_id');
    }

    public function contentItems(): BelongsToMany
    {
        return $this->belongsToMany(ContentItem::class, 'content_media', 'media_asset_id', 'content_id')
            ->withPivot('position')
            ->withTimestamps();
    }
}
