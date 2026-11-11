<?php

namespace App\Http\Middleware;

use Illuminate\Auth\Middleware\Authenticate as Middleware;
use Illuminate\Http\Request;

class Authenticate extends Middleware
{
    /**
     * API only: never redirect, an unauthenticated request gets a 401 JSON response.
     */
    protected function redirectTo(Request $request): ?string
    {
        return null;
    }
}
