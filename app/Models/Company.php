<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Company extends Model
{
    protected $table = 'companies';

    protected $guarded = ['id'];

    protected $casts = [
        'subscription_ends_at' => 'datetime',
        'features' => 'array',
    ];

    public function plan(): BelongsTo
    {
        return $this->belongsTo(Plan::class, 'plan_id');
    }

    public function roles(): HasMany
    {
        return $this->hasMany(Role::class, 'company_id');
    }

    public function clients(): HasMany
    {
        return $this->hasMany(Client::class, 'company_id');
    }

    public function users(): HasMany
    {
        return $this->hasMany(User::class, 'company_id');
    }

    public function aiPolicies(): HasMany
    {
        return $this->hasMany(AiPolicy::class, 'company_id');
    }

    public function agentConfigs(): HasMany
    {
        return $this->hasMany(AgentConfig::class, 'company_id');
    }

    public function brandIdentities(): HasMany
    {
        return $this->hasMany(BrandIdentity::class, 'company_id');
    }

    public function contracts(): HasMany
    {
        return $this->hasMany(Contract::class, 'company_id');
    }

    public function tasks(): HasMany
    {
        return $this->hasMany(Task::class, 'company_id');
    }

    public function clientRequests(): HasMany
    {
        return $this->hasMany(ClientRequest::class, 'company_id');
    }

    public function clientInteractions(): HasMany
    {
        return $this->hasMany(ClientInteraction::class, 'company_id');
    }

    public function satisfactionFeedback(): HasMany
    {
        return $this->hasMany(SatisfactionFeedback::class, 'company_id');
    }

    public function socialAccounts(): HasMany
    {
        return $this->hasMany(SocialAccount::class, 'company_id');
    }

    public function agentRuns(): HasMany
    {
        return $this->hasMany(AgentRun::class, 'company_id');
    }

    public function campaigns(): HasMany
    {
        return $this->hasMany(Campaign::class, 'company_id');
    }

    public function contentItems(): HasMany
    {
        return $this->hasMany(ContentItem::class, 'company_id');
    }

    public function contentVersions(): HasMany
    {
        return $this->hasMany(ContentVersion::class, 'company_id');
    }

    public function conversations(): HasMany
    {
        return $this->hasMany(Conversation::class, 'company_id');
    }

    public function messages(): HasMany
    {
        return $this->hasMany(Message::class, 'company_id');
    }

    public function meetings(): HasMany
    {
        return $this->hasMany(Meeting::class, 'company_id');
    }

    public function meetingActionItems(): HasMany
    {
        return $this->hasMany(MeetingActionItem::class, 'company_id');
    }

    public function knowledgeItems(): HasMany
    {
        return $this->hasMany(KnowledgeItem::class, 'company_id');
    }

    public function clientRules(): HasMany
    {
        return $this->hasMany(ClientRule::class, 'company_id');
    }

    public function mediaAssets(): HasMany
    {
        return $this->hasMany(MediaAsset::class, 'company_id');
    }

    public function approvals(): HasMany
    {
        return $this->hasMany(Approval::class, 'company_id');
    }

    public function publishJobs(): HasMany
    {
        return $this->hasMany(PublishJob::class, 'company_id');
    }

    public function performanceMetrics(): HasMany
    {
        return $this->hasMany(PerformanceMetric::class, 'company_id');
    }

    public function goals(): HasMany
    {
        return $this->hasMany(Goal::class, 'company_id');
    }

    public function reports(): HasMany
    {
        return $this->hasMany(Report::class, 'company_id');
    }

    public function recommendations(): HasMany
    {
        return $this->hasMany(Recommendation::class, 'company_id');
    }

    public function notifications(): HasMany
    {
        return $this->hasMany(Notification::class, 'company_id');
    }

    public function auditLogs(): HasMany
    {
        return $this->hasMany(AuditLog::class, 'company_id');
    }

    public function taskDependencies(): HasMany
    {
        return $this->hasMany(TaskDependency::class, 'company_id');
    }

    public function agentRunSteps(): HasMany
    {
        return $this->hasMany(AgentRunStep::class, 'company_id');
    }
}
