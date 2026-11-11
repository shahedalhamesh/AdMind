<?php

use App\Http\Controllers\Api\AgentController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\ClientController;
use App\Http\Controllers\Api\ClientDocumentController;
use App\Http\Controllers\Api\ClientProfileController;
use Illuminate\Support\Facades\Route;

Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:10,1');

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/me', [AuthController::class, 'me']);
    Route::post('/logout', [AuthController::class, 'logout']);

    // Clients
    Route::get('/clients', [ClientController::class, 'index'])->middleware('permission:clients.view');
    Route::post('/clients', [ClientController::class, 'store'])->middleware('permission:clients.create');
    Route::post('/clients/extract-profile', [ClientProfileController::class, 'extract'])->middleware('permission:clients.update');

    Route::prefix('clients/{id}')->whereNumber('id')->group(function () {
        Route::get('/', [ClientController::class, 'show'])->middleware('permission:clients.view');
        Route::put('/', [ClientController::class, 'update'])->middleware('permission:clients.update');
        Route::delete('/', [ClientController::class, 'destroy'])->middleware('permission:clients.delete');

        Route::get('/profile', [ClientProfileController::class, 'show'])->middleware('permission:clients.view');
        Route::put('/profile', [ClientProfileController::class, 'update'])->middleware('permission:clients.update');

        Route::get('/documents', [ClientDocumentController::class, 'index'])->middleware('permission:clients.view');
        Route::post('/documents', [ClientDocumentController::class, 'store'])->middleware('permission:clients.update');
        Route::delete('/documents/{documentId}', [ClientDocumentController::class, 'destroy'])
            ->whereNumber('documentId')->middleware('permission:clients.update');
    });

    // AI agents
    Route::middleware('permission:agents.run')->prefix('agent')->group(function () {
        Route::post('/chat', [AgentController::class, 'chat']);
        Route::post('/run', [AgentController::class, 'run']);
        Route::get('/runs/{id}', [AgentController::class, 'show']);
        Route::get('/conversations/{id}/messages', [AgentController::class, 'messages']);
    });
});
