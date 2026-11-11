<?php

namespace App\Models;

use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Campaign extends Model
{
    use BelongsToCompany;

    protected $table = 'campaigns';

    protected $guarded = ['id', 'company_id'];

    protected $casts = [
        'budget' => 'decimal:2',
        'spent' => 'decimal:2',
        'channels' => 'array',
        'audience' => 'array',
        'starts_on' => 'date',
        'ends_on' => 'date',
        'plan' => 'array',
    ];

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class, 'company_id');
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class, 'client_id');
    }

    public function contentItems(): HasMany
    {
        return $this->hasMany(ContentItem::class, 'campaign_id');
    }
}
