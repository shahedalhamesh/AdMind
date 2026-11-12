<?php

use App\Http\Controllers\Api\AgentController;
use App\Http\Controllers\Api\ApprovalController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\CampaignController;
use App\Http\Controllers\Api\ClientController;
use App\Http\Controllers\Api\ClientDocumentController;
use App\Http\Controllers\Api\ClientProfileController;
use App\Http\Controllers\Api\ContentController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\TaskController;
use App\Http\Controllers\Api\UserController;
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

    // Tasks
    Route::get('/tasks', [TaskController::class, 'index'])->middleware('permission:tasks.view');
    Route::post('/tasks', [TaskController::class, 'store'])->middleware('permission:tasks.create');

    Route::prefix('tasks/{id}')->whereNumber('id')->group(function () {
        Route::get('/', [TaskController::class, 'show'])->middleware('permission:tasks.view');
        Route::put('/', [TaskController::class, 'update'])->middleware('permission:tasks.update');
        Route::delete('/', [TaskController::class, 'destroy'])->middleware('permission:tasks.delete');
        Route::post('/run', [TaskController::class, 'run'])->middleware('permission:tasks.assign');
        Route::post('/dependencies', [TaskController::class, 'addDependency'])->middleware('permission:tasks.assign');
        Route::delete('/dependencies/{dependsOnId}', [TaskController::class, 'removeDependency'])
            ->whereNumber('dependsOnId')->middleware('permission:tasks.assign');
    });

    // Campaigns
    Route::get('/campaigns', [CampaignController::class, 'index'])->middleware('permission:campaigns.view');
    Route::post('/campaigns', [CampaignController::class, 'store'])->middleware('permission:campaigns.create');

    Route::prefix('campaigns/{id}')->whereNumber('id')->group(function () {
        Route::get('/', [CampaignController::class, 'show'])->middleware('permission:campaigns.view');
        Route::put('/', [CampaignController::class, 'update'])->middleware('permission:campaigns.update');
        Route::delete('/', [CampaignController::class, 'destroy'])->middleware('permission:campaigns.delete');
    });

    // Users and roles
    Route::get('/users', [UserController::class, 'index'])->middleware('permission:users.view');
    Route::post('/users', [UserController::class, 'store'])->middleware('permission:users.create');
    Route::get('/users/{id}', [UserController::class, 'show'])->whereNumber('id')->middleware('permission:users.view');
    Route::put('/users/{id}', [UserController::class, 'update'])->whereNumber('id')->middleware('permission:users.update');
    Route::get('/roles', [UserController::class, 'roles'])->middleware('permission:users.view');
    Route::post('/me/password', [UserController::class, 'changePassword']);

    // Content
    Route::get('/content', [ContentController::class, 'index'])->middleware('permission:content.view');
    Route::post('/content', [ContentController::class, 'store'])->middleware('permission:content.create');

    Route::prefix('content/{id}')->whereNumber('id')->group(function () {
        Route::get('/', [ContentController::class, 'show'])->middleware('permission:content.view');
        Route::put('/', [ContentController::class, 'update'])->middleware('permission:content.update');
        Route::post('/versions', [ContentController::class, 'addVersion'])->middleware('permission:content.update');
        Route::post('/submit', [ContentController::class, 'submit'])->middleware('permission:content.update');
        Route::post('/revise', [ContentController::class, 'revise'])->middleware('permission:content.update');
    });

    // Approvals
    Route::get('/approvals', [ApprovalController::class, 'index'])->middleware('permission:approvals.respond');
    Route::post('/approvals/{id}/decision', [ApprovalController::class, 'decide'])
        ->whereNumber('id')->middleware('permission:approvals.respond');

    // Notifications (own)
    Route::get('/notifications', [NotificationController::class, 'index']);
    Route::post('/notifications/read-all', [NotificationController::class, 'readAll']);
    Route::post('/notifications/{id}/read', [NotificationController::class, 'read'])->whereNumber('id');

    // AI agents
    Route::middleware('permission:agents.run')->prefix('agent')->group(function () {
        Route::post('/chat', [AgentController::class, 'chat']);
        Route::post('/run', [AgentController::class, 'run']);
        Route::get('/runs/{id}', [AgentController::class, 'show']);
        Route::get('/conversations/{id}/messages', [AgentController::class, 'messages']);
    });
});
