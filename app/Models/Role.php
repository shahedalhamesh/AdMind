<?php

namespace App\Models;

use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Role extends Model
{
    use BelongsToCompany;

    protected $table = 'roles';

    protected $guarded = ['id', 'company_id'];

    protected $casts = [
        'permissions' => 'array',
    ];

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class, 'company_id');
    }

    public function users(): HasMany
    {
        return $this->hasMany(User::class, 'role_id');
    }
}
