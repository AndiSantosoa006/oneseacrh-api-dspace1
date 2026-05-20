<?php

use App\Http\Controllers\SearchController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| WEB
|--------------------------------------------------------------------------
*/

Route::get('/', [SearchController::class, 'index']);

/*
|--------------------------------------------------------------------------
| API DSPACE
|--------------------------------------------------------------------------
*/

Route::get('/api/collections', [
    SearchController::class,
    'collections'
]);

Route::get('/api/collections/{uuid}/items', [
    SearchController::class,
    'collectionItems'
]);

require __DIR__ . '/auth.php';
