<?php

namespace App\Models;

use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Contract extends Model
{
    use BelongsToCompany;

    protected $table = 'contracts';

    protected $guarded = ['id', 'company_id'];

    protected $casts = [
        'starts_on' => 'date:Y-m-d',
        'ends_on' => 'date:Y-m-d',
        'renewal_date' => 'date:Y-m-d',
        'amount' => 'decimal:2',
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
