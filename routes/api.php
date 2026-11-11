<?php

use App\Http\Controllers\Api\AgentController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\ClientController;
use Illuminate\Support\Facades\Route;

Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:10,1');

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/me', [AuthController::class, 'me']);
    Route::post('/logout', [AuthController::class, 'logout']);

    Route::get('/clients', [ClientController::class, 'index'])->middleware('permission:clients.view');
    Route::post('/clients', [ClientController::class, 'store'])->middleware('permission:clients.create');

    // AI agents
    Route::middleware('permission:agents.run')->prefix('agent')->group(function () {
        Route::post('/chat', [AgentController::class, 'chat']);
        Route::post('/run', [AgentController::class, 'run']);
        Route::get('/runs/{id}', [AgentController::class, 'show']);
        Route::get('/conversations/{id}/messages', [AgentController::class, 'messages']);
    });
});
