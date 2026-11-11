<?php

namespace App\Models;

use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MeetingActionItem extends Model
{
    use BelongsToCompany;

    protected $table = 'meeting_action_items';

    protected $guarded = ['id', 'company_id'];

    protected $casts = [
        'due_date' => 'date',
    ];

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class, 'company_id');
    }

    public function meeting(): BelongsTo
    {
        return $this->belongsTo(Meeting::class, 'meeting_id');
    }

    public function suggestedAssignee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'suggested_assignee_id');
    }

    public function task(): BelongsTo
    {
        return $this->belongsTo(Task::class, 'task_id');
    }
}
