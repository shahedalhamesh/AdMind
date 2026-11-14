<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    */

    'mailgun' => [
        'domain' => env('MAILGUN_DOMAIN'),
        'secret' => env('MAILGUN_SECRET'),
        'endpoint' => env('MAILGUN_ENDPOINT', 'api.mailgun.net'),
        'scheme' => 'https',
    ],

    'postmark' => [
        'token' => env('POSTMARK_TOKEN'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    // AdMind AI service (FastAPI + CrewAI)
    'google' => [
        // OAuth client id from Google Cloud (Web application). Only the id is needed, no secret.
        'client_id' => env('GOOGLE_CLIENT_ID'),
    ],

    'ai' => [
        'url' => env('AI_SERVICE_URL', 'http://127.0.0.1:8000'),
        'key' => env('AI_SERVICE_KEY'),
        'timeout' => (int) env('AI_SERVICE_TIMEOUT', 600), // a crew run can take minutes
    ],

];
