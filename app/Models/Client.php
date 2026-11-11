<?php

namespace App\Models;

use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;

class Client extends Model
{
    use BelongsToCompany, SoftDeletes;

    protected $table = 'clients';

    protected $guarded = ['id', 'company_id'];

    protected $casts = [
        'agreed_services' => 'array',
    ];

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class, 'company_id');
    }

    public function responsibleUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'responsible_user_id');
    }

    public function users(): HasMany
    {
        return $this->hasMany(User::class, 'client_id');
    }

    public function aiPolicies(): HasMany
    {
        return $this->hasMany(AiPolicy::class, 'client_id');
    }

    public function brandIdentity(): HasOne
    {
        return $this->hasOne(BrandIdentity::class, 'client_id');
    }

    public function contracts(): HasMany
    {
        return $this->hasMany(Contract::class, 'client_id');
    }

    public function tasks(): HasMany
    {
        return $this->hasMany(Task::class, 'client_id');
    }

    public function clientRequests(): HasMany
    {
        return $this->hasMany(ClientRequest::class, 'client_id');
    }

    public function clientInteractions(): HasMany
    {
        return $this->hasMany(ClientInteraction::class, 'client_id');
    }

    public function satisfactionFeedback(): HasMany
    {
        return $this->hasMany(SatisfactionFeedback::class, 'client_id');
    }

    public function socialAccounts(): HasMany
    {
        return $this->hasMany(SocialAccount::class, 'client_id');
    }

    public function agentRuns(): HasMany
    {
        return $this->hasMany(AgentRun::class, 'client_id');
    }

    public function campaigns(): HasMany
    {
        return $this->hasMany(Campaign::class, 'client_id');
    }

    public function contentItems(): HasMany
    {
        return $this->hasMany(ContentItem::class, 'client_id');
    }

    public function conversations(): HasMany
    {
        return $this->hasMany(Conversation::class, 'client_id');
    }

    public function meetings(): HasMany
    {
        return $this->hasMany(Meeting::class, 'client_id');
    }

    public function knowledgeItems(): HasMany
    {
        return $this->hasMany(KnowledgeItem::class, 'client_id');
    }

    public function clientRules(): HasMany
    {
        return $this->hasMany(ClientRule::class, 'client_id');
    }

    public function mediaAssets(): HasMany
    {
        return $this->hasMany(MediaAsset::class, 'client_id');
    }

    public function performanceMetrics(): HasMany
    {
        return $this->hasMany(PerformanceMetric::class, 'client_id');
    }

    public function goals(): HasMany
    {
        return $this->hasMany(Goal::class, 'client_id');
    }

    public function reports(): HasMany
    {
        return $this->hasMany(Report::class, 'client_id');
    }

    public function recommendations(): HasMany
    {
        return $this->hasMany(Recommendation::class, 'client_id');
    }
}
