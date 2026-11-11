<?php

namespace App\Models;

use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AgentConfig extends Model
{
    use BelongsToCompany;

    protected $table = 'agent_configs';

    protected $guarded = ['id', 'company_id'];

    protected $casts = [
        'enabled' => 'boolean',
        'allowed_tools' => 'array',
    ];

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class, 'company_id');
    }
}
