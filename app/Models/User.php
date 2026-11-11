<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens;

    protected $table = 'users';

    protected $fillable = [
        'company_id', 'role_id', 'client_id', 'name', 'email', 'password', 'status',
    ];

    protected $hidden = ['password'];

    protected $casts = [
        'last_login_at' => 'datetime',
    ];

    /** Hash the password automatically (already hashed values are kept as they are). */
    protected function password(): Attribute
    {
        return Attribute::make(
            set: fn (string $value) => Hash::needsRehash($value) ? Hash::make($value) : $value,
        );
    }

    public function isPlatformAdmin(): bool
    {
        return $this->company_id === null;
    }

    /**
     * Permission check. Platform Admin can do everything.
     * Supports "*" (all) and wildcards such as "clients.*".
     */
    public function hasPermission(string $permission): bool
    {
        if ($this->isPlatformAdmin()) {
            return true;
        }

        foreach ($this->role?->permissions ?? [] as $granted) {
            if ($granted === '*' || $granted === $permission) {
                return true;
            }
            if (str_ends_with($granted, '.*') && str_starts_with($permission, substr($granted, 0, -1))) {
                return true;
            }
        }

        return false;
    }

    public function isActive(): bool
    {
        return $this->status === 'active';
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class, 'company_id');
    }

    public function role(): BelongsTo
    {
        return $this->belongsTo(Role::class, 'role_id');
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class, 'client_id');
    }

    public function escalationPolicies(): HasMany
    {
        return $this->hasMany(AiPolicy::class, 'escalate_to_user_id');
    }

    public function assignedTasks(): HasMany
    {
        return $this->hasMany(Task::class, 'assignee_user_id');
    }

    public function submittedRequests(): HasMany
    {
        return $this->hasMany(ClientRequest::class, 'submitted_by_user_id');
    }

    public function conversations(): HasMany
    {
        return $this->hasMany(Conversation::class, 'user_id');
    }

    public function sentMessages(): HasMany
    {
        return $this->hasMany(Message::class, 'sender_id');
    }

    public function suggestedActionItems(): HasMany
    {
        return $this->hasMany(MeetingActionItem::class, 'suggested_assignee_id');
    }

    public function requestedApprovals(): HasMany
    {
        return $this->hasMany(Approval::class, 'requested_from_id');
    }

    public function notifications(): HasMany
    {
        return $this->hasMany(Notification::class, 'user_id');
    }

    public function auditLogs(): HasMany
    {
        return $this->hasMany(AuditLog::class, 'actor_id');
    }

    public function responsibleClients(): HasMany
    {
        return $this->hasMany(Client::class, 'responsible_user_id');
    }
}
