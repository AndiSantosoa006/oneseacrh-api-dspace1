<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Inertia\Inertia;

class SearchController extends Controller
{
    public function index()
    {
        return Inertia::render('Search/Index');
    }

    /**
     * Semua collections
     */
    public function collections()
    {
        try {

            $response = Http::timeout(30)
                ->withHeaders([
                    'Accept' => 'application/json',
                ])
                ->get(
                    'https://repository.ibrahimy.ac.id/rest/collections'
                );

            return response()->json([
                'status' => 'success',
                'results' => $response->json()
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

            $keyword = strtolower(
                trim($request->input('q', ''))
            );

            $response = Http::timeout(60)
                ->withHeaders([
                    'Accept' => 'application/json',
                ])
                ->get(
                    "https://repository.ibrahimy.ac.id/rest/collections/{$uuid}/items",
                    [
                        'limit' => 100,
                        'offset' => 0,
                    ]
                );

            if (!$response->successful()) {

                return response()->json([
                    'status' => 'error',
                    'message' => 'Gagal mengambil items'
                ], 500);
            }

            $items = $response->json();

            if (!is_array($items)) {
                $items = [];
            }

            /**
             * Tambahkan metadata abstract
             */

            foreach ($items as &$item) {

                $itemUuid = $item['uuid'] ?? $item['UUID'] ?? null;

                $item['abstract'] = '';

                if ($itemUuid) {

                    try {

                        $metaResponse = Http::timeout(30)
                            ->withHeaders([
                                'Accept' => 'application/json',
                            ])
                            ->get(
                                "https://repository.ibrahimy.ac.id/rest/items/{$itemUuid}/metadata"
                            );

                        if ($metaResponse->successful()) {

                            $metadata = $metaResponse->json();

                            foreach ($metadata as $meta) {

                                if (
                                    ($meta['key'] ?? '') === 'dc.description.abstract'
                                ) {

                                    $item['abstract'] =
                                        $meta['value'] ?? '';

                                    break;
                                }
                            }
                        }
                    } catch (\Exception $e) {

                        $item['abstract'] = '';
                    }
                }
            }

            /**
             * FILTER SEARCH
             */

            if (!empty($keyword)) {

                $items = array_filter($items, function ($item) use ($keyword) {

                    $title = strtolower(
                        $item['name'] ?? ''
                    );

                    $handle = strtolower(
                        $item['handle'] ?? ''
                    );

                    $abstract = strtolower(
                        $item['abstract'] ?? ''
                    );

                    return
                        str_contains($title, $keyword) ||
                        str_contains($handle, $keyword) ||
                        str_contains($abstract, $keyword);
                });

                $items = array_values($items);
            }

            return response()->json([
                'status' => 'success',
                'results' => $items
            ]);
        } catch (\Exception $e) {

            return response()->json([
                'status' => 'error',
                'message' => $e->getMessage()
            ], 500);
        }
    }
}
