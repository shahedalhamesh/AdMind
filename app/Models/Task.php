<?php

namespace App\Models;

use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Task extends Model
{
    use BelongsToCompany;

    protected $table = 'tasks';

    protected $guarded = ['id', 'company_id'];

    protected $casts = [
        'due_at' => 'datetime',
        'started_at' => 'datetime',
        'completed_at' => 'datetime',
    ];

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class, 'company_id');
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class, 'client_id');
    }

    public function parentTask(): BelongsTo
    {
        return $this->belongsTo(Task::class, 'parent_task_id');
    }

    public function assigneeUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assignee_user_id');
    }

    public function subtasks(): HasMany
    {
        return $this->hasMany(Task::class, 'parent_task_id');
    }

    public function clientRequests(): HasMany
    {
        return $this->hasMany(ClientRequest::class, 'task_id');
    }

    public function agentRuns(): HasMany
    {
        return $this->hasMany(AgentRun::class, 'task_id');
    }

    public function contentItems(): HasMany
    {
        return $this->hasMany(ContentItem::class, 'task_id');
    }

    public function conversations(): HasMany
    {
        return $this->hasMany(Conversation::class, 'task_id');
    }

    public function meetingActionItems(): HasMany
    {
        return $this->hasMany(MeetingActionItem::class, 'task_id');
    }

    public function dependencies(): HasMany
    {
        return $this->hasMany(TaskDependency::class, 'task_id');
    }

    public function dependents(): HasMany
    {
        return $this->hasMany(TaskDependency::class, 'depends_on_task_id');
    }
}
