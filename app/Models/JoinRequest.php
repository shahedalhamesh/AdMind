<?php

namespace App\Models;

use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class JoinRequest extends Model
{
    use BelongsToCompany;

    protected $table = 'join_requests';

    protected $guarded = ['id', 'company_id'];

    protected $hidden = ['password_hash'];

    protected $casts = [
        'via_google' => 'boolean',
        'decided_at' => 'datetime',
    ];

    public function role(): BelongsTo
    {
        return $this->belongsTo(Role::class, 'role_id');
    }

    public function joinLink(): BelongsTo
    {
        return $this->belongsTo(JoinLink::class, 'join_link_id');
    }
}
