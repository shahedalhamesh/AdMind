<?php

namespace App\Models;

use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class JoinLink extends Model
{
    use BelongsToCompany;

    protected $table = 'join_links';

    protected $guarded = ['id', 'company_id'];

    protected $hidden = ['token_hash'];

    protected $casts = [
        'expires_at' => 'datetime',
        'revoked_at' => 'datetime',
    ];

    protected $appends = ['status'];

    /** active | revoked | expired | full (max_uses reached) */
    public function getStatusAttribute(): string
    {
        return match (true) {
            $this->revoked_at !== null => 'revoked',
            $this->expires_at->isPast() => 'expired',
            $this->max_uses !== null && $this->uses_count >= $this->max_uses => 'full',
            default => 'active',
        };
    }

    public static function hashToken(string $token): string
    {
        return hash('sha256', $token);
    }

    public function role(): BelongsTo
    {
        return $this->belongsTo(Role::class, 'role_id');
    }
}
