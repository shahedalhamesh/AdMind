<?php

namespace App\Http\Controllers\Concerns;

use Illuminate\Http\Request;

trait ResolvesCompany
{
    /** A platform admin has no company: they must say which one with company_id. */
    protected function companyId(Request $request): int
    {
        $companyId = $request->user()->company_id ?? $request->integer('company_id');
        abort_unless($companyId, 422, 'company_id is required for a platform admin.');

        return (int) $companyId;
    }
}
