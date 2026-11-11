<?php

namespace App\Models;

use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Report extends Model
{
    use BelongsToCompany;

    protected $table = 'reports';

    protected $guarded = ['id', 'company_id'];

    protected $casts = [
        'period_start' => 'date',
        'period_end' => 'date',
        'data' => 'array',
        'visible_to_client' => 'boolean',
        'generated_at' => 'datetime',
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
