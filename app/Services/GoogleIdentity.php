<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;

/** Checks a Google ID token (from Google Identity Services) with Google. */
class GoogleIdentity
{
    public static function configured(): bool
    {
        return (bool) config('services.google.client_id');
    }

    /** The token info (email, name...) when the token is valid for this app and the email is verified; else null. */
    public static function verify(string $credential): ?array
    {
        $response = Http::timeout(10)->get('https://oauth2.googleapis.com/tokeninfo', ['id_token' => $credential]);
        if (! $response->ok()) {
            return null;
        }
        $info = $response->json();
        if (($info['aud'] ?? null) !== config('services.google.client_id')
            || ! in_array($info['iss'] ?? '', ['accounts.google.com', 'https://accounts.google.com'], true)
            || ($info['email_verified'] ?? 'false') !== 'true'
            || empty($info['email'])) {
            return null;
        }

        return $info;
    }
}
