<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Plan extends Model
{
    protected $table = 'plans';

    protected $guarded = ['id'];

    protected $casts = [
        'price_monthly' => 'decimal:2',
        'features' => 'array',
        'is_active' => 'boolean',
    ];

    public function companies(): HasMany
    {
        return $this->hasMany(Company::class, 'plan_id');
    }
}
