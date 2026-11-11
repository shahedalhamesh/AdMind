<?php

namespace App\Models;

use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class AgentRun extends Model
{
    use BelongsToCompany;

    protected $table = 'agent_runs';

    protected $guarded = ['id', 'company_id'];

    protected $casts = [
        'input' => 'array',
        'started_at' => 'datetime',
        'finished_at' => 'datetime',
        'cost' => 'decimal:4',
    ];

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class, 'company_id');
    }

    public function task(): BelongsTo
    {
        return $this->belongsTo(Task::class, 'task_id');
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class, 'client_id');
    }

    public function conversation(): BelongsTo
    {
        return $this->belongsTo(Conversation::class, 'conversation_id');
    }

    public function generatedContentItems(): HasMany
    {
        return $this->hasMany(ContentItem::class, 'source_run_id');
    }

    public function contentVersions(): HasMany
    {
        return $this->hasMany(ContentVersion::class, 'agent_run_id');
    }

    public function mediaAssets(): HasMany
    {
        return $this->hasMany(MediaAsset::class, 'agent_run_id');
    }

    public function agentRunSteps(): HasMany
    {
        return $this->hasMany(AgentRunStep::class, 'agent_run_id');
    }
}
