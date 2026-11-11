<?php

namespace App\Models\Concerns;

use Illuminate\Database\Eloquent\Builder;

/**
 * Tenant isolation (FR-03): every query on a model that uses this trait is
 * limited to the company of the logged-in user, and new rows get that company.
 *
 * - Platform Admin (company_id = null) sees every company.
 * - Background jobs and the AI service have no logged-in user: set
 *   $model->company_id yourself, and filter with ->withoutGlobalScopes()
 *   or ->where('company_id', $id).
 */
trait BelongsToCompany
{
    protected static function bootBelongsToCompany(): void
    {
        static::addGlobalScope('company', function (Builder $query) {
            $user = auth()->user();
            if ($user && $user->company_id !== null) {
                $query->where($query->getModel()->getTable() . '.company_id', $user->company_id);
            }
        });

        static::creating(function ($model) {
            $user = auth()->user();
            if ($model->company_id === null && $user && $user->company_id !== null) {
                $model->company_id = $user->company_id;
            }
        });
    }
}
