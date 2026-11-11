<?php

namespace App\Models;

use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ContentItem extends Model
{
    use BelongsToCompany;

    protected $table = 'content_items';

    protected $guarded = ['id', 'company_id'];

    protected $casts = [
        'scheduled_at' => 'datetime',
        'published_at' => 'datetime',
        'is_example' => 'boolean',
    ];

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class, 'company_id');
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class, 'client_id');
    }

    public function campaign(): BelongsTo
    {
        return $this->belongsTo(Campaign::class, 'campaign_id');
    }

    public function task(): BelongsTo
    {
        return $this->belongsTo(Task::class, 'task_id');
    }

    public function sourceRun(): BelongsTo
    {
        return $this->belongsTo(AgentRun::class, 'source_run_id');
    }

    public function currentVersion(): BelongsTo
    {
        return $this->belongsTo(ContentVersion::class, 'current_version_id');
    }

    public function versions(): HasMany
    {
        return $this->hasMany(ContentVersion::class, 'content_id');
    }

    public function conversations(): HasMany
    {
        return $this->hasMany(Conversation::class, 'content_id');
    }

    public function publishJobs(): HasMany
    {
        return $this->hasMany(PublishJob::class, 'content_id');
    }

    public function mediaAssets(): BelongsToMany
    {
        return $this->belongsToMany(MediaAsset::class, 'content_media', 'content_id', 'media_asset_id')
            ->withPivot('position')
            ->withTimestamps()
            ->orderBy('content_media.position');
    }
}
