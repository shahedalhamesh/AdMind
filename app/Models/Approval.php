<?php

namespace App\Models;

use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Approval extends Model
{
    use BelongsToCompany;

    protected $table = 'approvals';

    protected $guarded = ['id', 'company_id'];

    protected $casts = [
        'decided_at' => 'datetime',
        'consolidated_at' => 'datetime',
    ];

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class, 'company_id');
    }

    public function requestedFrom(): BelongsTo
    {
        return $this->belongsTo(User::class, 'requested_from_id');
    }
}
