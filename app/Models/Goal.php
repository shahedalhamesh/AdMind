<?php

namespace App\Models;

use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Goal extends Model
{
    use BelongsToCompany;

    protected $table = 'goals';

    protected $guarded = ['id', 'company_id'];

    protected $casts = [
        'target_value' => 'decimal:4',
        'starts_on' => 'date',
        'ends_on' => 'date',
    ];

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class, 'company_id');
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class, 'client_id');
    }
}
