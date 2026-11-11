<?php

namespace App\Models;

use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class KnowledgeItem extends Model
{
    use BelongsToCompany;

    protected $table = 'knowledge_items';

    protected $guarded = ['id', 'company_id'];

    protected $casts = [
        'tags' => 'array',
        'last_verified_at' => 'datetime',
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
