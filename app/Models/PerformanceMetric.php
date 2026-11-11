<?php

namespace App\Models;

use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PerformanceMetric extends Model
{
    use BelongsToCompany;

    protected $table = 'performance_metrics';

    protected $guarded = ['id', 'company_id'];

    protected $casts = [
        'value' => 'decimal:4',
        'metric_date' => 'date',
        'collected_at' => 'datetime',
        'is_stale' => 'boolean',
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
