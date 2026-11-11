<?php

namespace App\Models;

use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ContentVersion extends Model
{
    use BelongsToCompany;

    protected $table = 'content_versions';

    protected $guarded = ['id', 'company_id'];

    protected $casts = [
        'hashtags' => 'array',
    ];

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class, 'company_id');
    }

    public function content(): BelongsTo
    {
        return $this->belongsTo(ContentItem::class, 'content_id');
    }

    public function agentRun(): BelongsTo
    {
        return $this->belongsTo(AgentRun::class, 'agent_run_id');
    }

    public function publishJobs(): HasMany
    {
        return $this->hasMany(PublishJob::class, 'content_version_id');
    }

    public function contentItems(): HasMany
    {
        return $this->hasMany(ContentItem::class, 'current_version_id');
    }
}
