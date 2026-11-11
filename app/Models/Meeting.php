<?php

namespace App\Models;

use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Meeting extends Model
{
    use BelongsToCompany;

    protected $table = 'meetings';

    protected $guarded = ['id', 'company_id'];

    protected $casts = [
        'held_at' => 'datetime',
        'key_insights' => 'array',
    ];

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class, 'company_id');
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class, 'client_id');
    }

    public function meetingActionItems(): HasMany
    {
        return $this->hasMany(MeetingActionItem::class, 'meeting_id');
    }
}
