<?php

namespace App\Models;

use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BrandIdentity extends Model
{
    use BelongsToCompany;

    protected $table = 'brand_identities';

    protected $guarded = ['id', 'company_id'];

    protected $casts = [
        'colors' => 'array',
        'fonts' => 'array',
        'forbidden_words' => 'array',
        'platforms' => 'array',
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
