<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Http\Client\Pool;
use Inertia\Inertia;

class SearchController extends Controller
{
    private string $baseUrl = 'https://repository.ibrahimy.ac.id/rest';

    public function index()
    {
        return Inertia::render('Search/Index');
    }

    /**
     * Mengambil semua collections beserta total itemnya secara paralel
     */
    public function collections()
    {
        try {
            $response = Http::timeout(30)
                ->withHeaders(['Accept' => 'application/json'])
                ->get("{$this->baseUrl}/collections");

            if (!$response->successful()) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Gagal mengambil collections'
                ], 500);
            }

            $collections = $response->json();

            // Optimasi N+1: Ambil data total_items secara concurrent (bersamaan)
            $responses = Http::pool(function (Pool $pool) use ($collections) {
                foreach ($collections as $collection) {
                    $pool->withHeaders(['Accept' => 'application/json'])
                        ->timeout(15)
                        ->get("{$this->baseUrl}/collections/{$collection['uuid']}/items", [
                            'limit' => 1,
                            'offset' => 0,
                        ]);
                }
            });

            // Pasangkan kembali hasil jumlah item ke masing-masing koleksi
            foreach ($collections as $index => &$collection) {
                $itemResponse = $responses[$index] ?? null;
                $collection['total_items'] = 0;

                if ($itemResponse && $itemResponse->successful()) {
                    $items = $itemResponse->json();
                    $collection['total_items'] = is_array($items) ? count($items) : 0;
                }
            }

            return response()->json([
                'status' => 'success',
                'results' => $collections
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'status' => 'error',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Items berdasarkan collection
     */
    public function collectionItems($uuid, Request $request)
    {
        try {
            $keyword = strtolower(trim($request->input('q', '')));
            $limit = 100;
            $offset = 0;
            $allItems = [];

            // Loop pagination DSpace
            do {
                $response = Http::timeout(60)
                    ->withHeaders(['Accept' => 'application/json'])
                    ->get("{$this->baseUrl}/collections/{$uuid}/items", [
                        'limit' => $limit,
                        'offset' => $offset,
                    ]);

                if (!$response->successful()) {
                    return response()->json([
                        'status' => 'error',
                        'message' => 'Gagal mengambil items'
                    ], 500);
                }

                $items = $response->json();
                if (!is_array($items) || empty($items)) {
                    break;
                }

                // Optimasi N+1: Ambil semua metadata secara bersamaan untuk page ini
                $metaResponses = Http::pool(function (Pool $pool) use ($items) {
                    foreach ($items as $item) {
                        $itemUuid = $item['uuid'] ?? $item['UUID'] ?? null;
                        if ($itemUuid) {
                            $pool->withHeaders(['Accept' => 'application/json'])
                                ->timeout(15)
                                ->get("{$this->baseUrl}/items/{$itemUuid}/metadata");
                        }
                    }
                });

                // Proses hasil metadata dan lakukan filtering
                foreach ($items as $index => &$item) {
                    $item['abstract'] = '';
                    $metaResponse = $metaResponses[$index] ?? null;

                    if ($metaResponse && $metaResponse->successful()) {
                        $metadata = $metaResponse->json();
                        foreach ($metadata as $meta) {
                            if (($meta['key'] ?? '') === 'dc.description.abstract') {
                                $item['abstract'] = strip_tags($meta['value'] ?? '');
                                break;
                            }
                        }
                    }

                    // Filter pencarian (Search Client-side/API level)
                    if (!empty($keyword)) {
                        $title = strtolower($item['name'] ?? '');
                        $handle = strtolower($item['handle'] ?? '');
                        $abstract = strtolower($item['abstract'] ?? '');

                        if (str_contains($title, $keyword) || str_contains($handle, $keyword) || str_contains($abstract, $keyword)) {
                            $allItems[] = $item;
                        }
                    } else {
                        $allItems[] = $item;
                    }
                }

                $count = count($items);
                $offset += $limit;
            } while ($count === $limit);

            return response()->json([
                'status' => 'success',
                'total_items' => count($allItems),
                'results' => array_values($allItems)
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'status' => 'error',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Menghitung jumlah item per koleksi berdasarkan keyword
     */
    public function collectionCounts(Request $request)
    {
        try {
            $keyword = strtolower(trim($request->input('q', '')));

            $collectionsResponse = Http::timeout(30)
                ->withHeaders(['Accept' => 'application/json'])
                ->get("{$this->baseUrl}/collections");

            if (!$collectionsResponse->successful()) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Gagal mengambil collections'
                ], 500);
            }

            $collections = $collectionsResponse->json();
            $results = [];

            // Optimasi N+1: Ambil data items dari semua koleksi sekaligus
            $responses = Http::pool(function (Pool $pool) use ($collections) {
                foreach ($collections as $collection) {
                    $pool->withHeaders(['Accept' => 'application/json'])
                        ->timeout(30)
                        ->get("{$this->baseUrl}/collections/{$collection['uuid']}/items", [
                            'limit' => 100,
                            'offset' => 0,
                        ]);
                }
            });

            foreach ($collections as $index => $collection) {
                $itemsResponse = $responses[$index] ?? null;
                $items = ($itemsResponse && $itemsResponse->successful()) ? $itemsResponse->json() : [];

                if (!is_array($items)) {
                    $items = [];
                }

                if (!empty($keyword)) {
                    $items = array_filter($items, function ($item) use ($keyword) {
                        return str_contains(strtolower($item['name'] ?? ''), $keyword);
                    });
                }

                $results[] = [
                    'uuid' => $collection['uuid'],
                    'total_items' => count($items)
                ];
            }

            return response()->json([
                'status' => 'success',
                'results' => $results
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'status' => 'error',
                'message' => $e->getMessage()
            ], 500);
        }
    }
}
