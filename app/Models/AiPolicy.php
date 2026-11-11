<?php

namespace App\Models;

use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AiPolicy extends Model
{
    use BelongsToCompany;

    protected $table = 'ai_policies';

    protected $guarded = ['id', 'company_id'];

    protected $casts = [
        'max_spend' => 'decimal:2',
        'approval_rules' => 'array',
        'publish_rules' => 'array',
    ];

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class, 'company_id');
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class, 'client_id');
    }

    public function escalateToUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'escalate_to_user_id');
    }
}
