<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Client;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ClientController extends Controller
{
    // The company scope on Client already limits this to the user's own company.
    public function index(): JsonResponse
    {
        return response()->json(Client::orderBy('name')->get());
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'industry' => ['nullable', 'string', 'max:255'],
            'contact_name' => ['nullable', 'string', 'max:255'],
            'contact_email' => ['nullable', 'email', 'max:255'],
            'contact_phone' => ['nullable', 'string', 'max:50'],
            'goals' => ['nullable', 'string'],
            'agreed_services' => ['nullable', 'array'],
        ]);

        $client = Client::create($data + [
            'agreed_services' => $data['agreed_services'] ?? [],
            'status' => 'active',
        ]);

        return response()->json($client, 201);
    }
}
