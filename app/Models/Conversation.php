<?php

namespace App\Models;

use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Conversation extends Model
{
    use BelongsToCompany;

    protected $table = 'conversations';

    protected $guarded = ['id', 'company_id'];

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class, 'company_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class, 'client_id');
    }

    public function task(): BelongsTo
    {
        return $this->belongsTo(Task::class, 'task_id');
    }

    public function content(): BelongsTo
    {
        return $this->belongsTo(ContentItem::class, 'content_id');
    }

    public function messages(): HasMany
    {
        return $this->hasMany(Message::class, 'conversation_id');
    }

    public function agentRuns(): HasMany
    {
        return $this->hasMany(AgentRun::class, 'conversation_id');
    }
}
