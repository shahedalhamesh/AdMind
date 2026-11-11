<?php

use App\Http\Controllers\Api\AgentController;
use App\Http\Controllers\Api\ApprovalController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\ClientController;
use App\Http\Controllers\Api\ClientDocumentController;
use App\Http\Controllers\Api\ClientProfileController;
use App\Http\Controllers\Api\ContentController;
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

    // Content
    Route::get('/content', [ContentController::class, 'index'])->middleware('permission:content.view');
    Route::post('/content', [ContentController::class, 'store'])->middleware('permission:content.create');

    Route::prefix('content/{id}')->whereNumber('id')->group(function () {
        Route::get('/', [ContentController::class, 'show'])->middleware('permission:content.view');
        Route::put('/', [ContentController::class, 'update'])->middleware('permission:content.update');
        Route::post('/versions', [ContentController::class, 'addVersion'])->middleware('permission:content.update');
        Route::post('/submit', [ContentController::class, 'submit'])->middleware('permission:content.update');
    });

    // Approvals
    Route::get('/approvals', [ApprovalController::class, 'index'])->middleware('permission:approvals.respond');
    Route::post('/approvals/{id}/decision', [ApprovalController::class, 'decide'])
        ->whereNumber('id')->middleware('permission:approvals.respond');

    // AI agents
    Route::middleware('permission:agents.run')->prefix('agent')->group(function () {
        Route::post('/chat', [AgentController::class, 'chat']);
        Route::post('/run', [AgentController::class, 'run']);
        Route::get('/runs/{id}', [AgentController::class, 'show']);
        Route::get('/conversations/{id}/messages', [AgentController::class, 'messages']);
    });
});
