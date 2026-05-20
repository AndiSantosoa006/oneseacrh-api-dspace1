<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Http\Client\Pool;
use Inertia\Inertia;

class SearchController extends Controller
{
    private string $baseUrl =
    'https://repository.ibrahimy.ac.id/rest';

    public function index()
    {
        return Inertia::render('Search/Index');
    }

    /*
    |--------------------------------------------------------------------------
    | COLLECTIONS
    |--------------------------------------------------------------------------
    */

    public function collections()
    {
        try {
            $cacheKey = 'repository_collections';

            $cached = Cache::get($cacheKey);

            if ($cached) {
                return response()->json($cached);
            }

            $response = Http::timeout(30)
                ->withHeaders([
                    'Accept' => 'application/json',
                ])
                ->get(
                    "{$this->baseUrl}/collections"
                );

            if (!$response->successful()) {
                return response()->json([
                    'status' => 'error',
                    'message' =>
                    'Gagal mengambil collections',
                ]);
            }

            $collections = $response->json();

            $responses = Http::pool(
                function (Pool $pool) use (
                    $collections
                ) {
                    foreach (
                        $collections
                        as $collection
                    ) {
                        $pool
                            ->withHeaders([
                                'Accept' =>
                                'application/json',
                            ])
                            ->timeout(20)
                            ->get(
                                "{$this->baseUrl}/collections/{$collection['uuid']}/items",
                                [
                                    'limit' => 1,
                                    'offset' => 0,
                                ]
                            );
                    }
                }
            );

            foreach (
                $collections
                as $index => &$collection
            ) {
                $collection['total_items'] = 0;

                $itemResponse =
                    $responses[$index] ?? null;

                if (
                    $itemResponse &&
                    $itemResponse->successful()
                ) {
                    $items =
                        $itemResponse->json();

                    $collection['total_items'] =
                        is_array($items)
                        ? count($items)
                        : 0;
                }
            }

            $result = [
                'status' => 'success',
                'results' => $collections,
            ];

            Cache::put(
                $cacheKey,
                $result,
                now()->addMinutes(30)
            );

            return response()->json($result);
        } catch (\Exception $e) {
            return response()->json(
                [
                    'status' => 'error',
                    'message' =>
                    $e->getMessage(),
                ],
                500
            );
        }
    }

    /*
    |--------------------------------------------------------------------------
    | ITEMS PER COLLECTION
    |--------------------------------------------------------------------------
    */

    public function collectionItems(
        $uuid,
        Request $request
    ) {
        try {
            $keyword = strtolower(
                trim($request->input('q', ''))
            );

            $keywords = array_filter(
                preg_split('/\s+/', $keyword)
            );

            $cacheKey =
                'collection_items_' .
                $uuid .
                '_' .
                md5($keyword);

            $cached = Cache::get($cacheKey);

            if ($cached) {
                return response()->json($cached);
            }

            $limit = 100;
            $offset = 0;

            $allItems = [];

            do {
                $response = Http::timeout(60)
                    ->withHeaders([
                        'Accept' =>
                        'application/json',
                    ])
                    ->get(
                        "{$this->baseUrl}/collections/{$uuid}/items",
                        [
                            'limit' => $limit,
                            'offset' => $offset,
                        ]
                    );

                if (
                    !$response->successful()
                ) {
                    return response()->json(
                        [
                            'status' =>
                            'error',
                            'message' =>
                            'Gagal mengambil items',
                        ],
                        500
                    );
                }

                $items = $response->json();

                if (
                    !is_array($items) ||
                    empty($items)
                ) {
                    break;
                }

                /*
                |--------------------------------------------------------------------------
                | METADATA PARALLEL
                |--------------------------------------------------------------------------
                */

                $metaResponses =
                    Http::pool(
                        function (
                            Pool $pool
                        ) use ($items) {
                            foreach (
                                $items
                                as $item
                            ) {
                                $itemUuid =
                                    $item['uuid'] ??
                                    $item['UUID'] ??
                                    null;

                                if (
                                    $itemUuid
                                ) {
                                    $pool
                                        ->withHeaders(
                                            [
                                                'Accept' =>
                                                'application/json',
                                            ]
                                        )
                                        ->timeout(
                                            20
                                        )
                                        ->get(
                                            "{$this->baseUrl}/items/{$itemUuid}/metadata"
                                        );
                                }
                            }
                        }
                    );

                foreach (
                    $items
                    as $index => &$item
                ) {
                    $item['abstract'] = '';

                    $metaResponse =
                        $metaResponses[$index] ??
                        null;

                    if (
                        $metaResponse &&
                        $metaResponse->successful()
                    ) {
                        $metadata =
                            $metaResponse->json();

                        foreach (
                            $metadata
                            as $meta
                        ) {
                            if (
                                ($meta['key'] ??
                                    '') ===
                                'dc.description.abstract'
                            ) {
                                $item['abstract'] =
                                    strip_tags(
                                        $meta['value'] ??
                                            ''
                                    );

                                break;
                            }
                        }
                    }

                    /*
                    |--------------------------------------------------------------------------
                    | SEARCH TEXT
                    |--------------------------------------------------------------------------
                    */

                    $title = strtolower(
                        $item['name'] ?? ''
                    );

                    $handle = strtolower(
                        $item['handle'] ?? ''
                    );

                    $abstract = strtolower(
                        $item['abstract'] ?? ''
                    );

                    $searchText =
                        $title .
                        ' ' .
                        $handle .
                        ' ' .
                        $abstract;

                    /*
                    |--------------------------------------------------------------------------
                    | MULTI KEYWORD SEARCH
                    |--------------------------------------------------------------------------
                    */

                    $matched = true;

                    foreach (
                        $keywords
                        as $word
                    ) {
                        if (
                            !str_contains(
                                $searchText,
                                $word
                            )
                        ) {
                            $matched = false;
                            break;
                        }
                    }

                    if (
                        empty($keywords)
                    ) {
                        $allItems[] = $item;
                    } elseif ($matched) {
                        $allItems[] = $item;
                    }
                }

                $count = count($items);

                $offset += $limit;
            } while ($count === $limit);

            $result = [
                'status' => 'success',
                'total_items' => count(
                    $allItems
                ),
                'results' => array_values(
                    $allItems
                ),
            ];

            Cache::put(
                $cacheKey,
                $result,
                now()->addMinutes(20)
            );

            return response()->json($result);
        } catch (\Exception $e) {
            return response()->json(
                [
                    'status' => 'error',
                    'message' =>
                    $e->getMessage(),
                ],
                500
            );
        }
    }

    /*
    |--------------------------------------------------------------------------
    | COLLECTION COUNTS
    |--------------------------------------------------------------------------
    */

    public function collectionCounts(
        Request $request
    ) {
        try {
            $keyword = strtolower(
                trim($request->input('q', ''))
            );

            $keywords = array_filter(
                preg_split('/\s+/', $keyword)
            );

            $cacheKey =
                'collection_counts_' .
                md5($keyword);

            $cached = Cache::get($cacheKey);

            if ($cached) {
                return response()->json($cached);
            }

            $collectionsResponse =
                Http::timeout(30)
                ->withHeaders([
                    'Accept' =>
                    'application/json',
                ])
                ->get(
                    "{$this->baseUrl}/collections"
                );

            if (
                !$collectionsResponse->successful()
            ) {
                return response()->json(
                    [
                        'status' =>
                        'error',
                        'message' =>
                        'Gagal mengambil collections',
                    ]
                );
            }

            $collections =
                $collectionsResponse->json();

            $responses = Http::pool(
                function (Pool $pool) use (
                    $collections
                ) {
                    foreach (
                        $collections
                        as $collection
                    ) {
                        $pool
                            ->withHeaders([
                                'Accept' =>
                                'application/json',
                            ])
                            ->timeout(30)
                            ->get(
                                "{$this->baseUrl}/collections/{$collection['uuid']}/items",
                                [
                                    'limit' => 100,
                                    'offset' => 0,
                                ]
                            );
                    }
                }
            );

            $results = [];

            foreach (
                $collections
                as $index => $collection
            ) {
                $itemsResponse =
                    $responses[$index] ?? null;

                $items =
                    $itemsResponse &&
                    $itemsResponse->successful()
                    ? $itemsResponse->json()
                    : [];

                if (!is_array($items)) {
                    $items = [];
                }

                if (!empty($keywords)) {
                    $items = array_filter(
                        $items,
                        function (
                            $item
                        ) use (
                            $keywords
                        ) {
                            $title = strtolower(
                                $item['name'] ?? ''
                            );

                            foreach (
                                $keywords
                                as $word
                            ) {
                                if (
                                    !str_contains(
                                        $title,
                                        $word
                                    )
                                ) {
                                    return false;
                                }
                            }

                            return true;
                        }
                    );
                }

                $results[] = [
                    'uuid' =>
                    $collection['uuid'],
                    'total_items' => count(
                        $items
                    ),
                ];
            }

            $result = [
                'status' => 'success',
                'results' => $results,
            ];

            Cache::put(
                $cacheKey,
                $result,
                now()->addMinutes(10)
            );

            return response()->json($result);
        } catch (\Exception $e) {
            return response()->json(
                [
                    'status' => 'error',
                    'message' =>
                    $e->getMessage(),
                ],
                500
            );
        }
    }

    /*
    |--------------------------------------------------------------------------
    | GLOBAL SEARCH
    |--------------------------------------------------------------------------
    */

    public function globalSearch(
        Request $request
    ) {
        try {
            $keyword = strtolower(
                trim($request->input('q', ''))
            );

            $keywords = array_filter(
                preg_split('/\s+/', $keyword)
            );

            $cacheKey =
                'global_search_' .
                md5($keyword);

            $cached = Cache::get($cacheKey);

            if ($cached) {
                return response()->json($cached);
            }

            $collectionsResponse =
                Http::timeout(30)
                ->withHeaders([
                    'Accept' =>
                    'application/json',
                ])
                ->get(
                    "{$this->baseUrl}/collections"
                );

            if (
                !$collectionsResponse->successful()
            ) {
                return response()->json(
                    [
                        'status' =>
                        'error',
                        'message' =>
                        'Gagal mengambil collections',
                    ]
                );
            }

            $collections =
                $collectionsResponse->json();

            $responses = Http::pool(
                function (Pool $pool) use (
                    $collections
                ) {
                    foreach (
                        $collections
                        as $collection
                    ) {
                        $pool
                            ->withHeaders([
                                'Accept' =>
                                'application/json',
                            ])
                            ->timeout(60)
                            ->get(
                                "{$this->baseUrl}/collections/{$collection['uuid']}/items",
                                [
                                    'limit' => 100,
                                    'offset' => 0,
                                ]
                            );
                    }
                }
            );

            $allItems = [];

            foreach (
                $collections
                as $index => $collection
            ) {
                $itemsResponse =
                    $responses[$index] ?? null;

                $items =
                    $itemsResponse &&
                    $itemsResponse->successful()
                    ? $itemsResponse->json()
                    : [];

                if (!is_array($items)) {
                    continue;
                }

                $metaResponses =
                    Http::pool(
                        function (
                            Pool $pool
                        ) use ($items) {
                            foreach (
                                $items
                                as $item
                            ) {
                                $itemUuid =
                                    $item['uuid'] ??
                                    $item['UUID'] ??
                                    null;

                                if (
                                    $itemUuid
                                ) {
                                    $pool
                                        ->withHeaders(
                                            [
                                                'Accept' =>
                                                'application/json',
                                            ]
                                        )
                                        ->timeout(
                                            20
                                        )
                                        ->get(
                                            "{$this->baseUrl}/items/{$itemUuid}/metadata"
                                        );
                                }
                            }
                        }
                    );

                foreach (
                    $items
                    as $itemIndex => &$item
                ) {
                    $item['abstract'] = '';

                    $metaResponse =
                        $metaResponses[$itemIndex] ??
                        null;

                    if (
                        $metaResponse &&
                        $metaResponse->successful()
                    ) {
                        $metadata =
                            $metaResponse->json();

                        foreach (
                            $metadata
                            as $meta
                        ) {
                            if (
                                ($meta['key'] ??
                                    '') ===
                                'dc.description.abstract'
                            ) {
                                $item['abstract'] =
                                    strip_tags(
                                        $meta['value'] ??
                                            ''
                                    );

                                break;
                            }
                        }
                    }

                    $title = strtolower(
                        $item['name'] ?? ''
                    );

                    $handle = strtolower(
                        $item['handle'] ?? ''
                    );

                    $abstract = strtolower(
                        $item['abstract'] ?? ''
                    );

                    $searchText =
                        $title .
                        ' ' .
                        $handle .
                        ' ' .
                        $abstract;

                    $matched = true;

                    foreach (
                        $keywords
                        as $word
                    ) {
                        if (
                            !str_contains(
                                $searchText,
                                $word
                            )
                        ) {
                            $matched = false;
                            break;
                        }
                    }

                    if (
                        empty($keywords)
                    ) {
                        $allItems[] = [
                            ...$item,
                            'collection_name' =>
                            $collection['name'],
                            'collection_uuid' =>
                            $collection['uuid'],
                        ];
                    } elseif ($matched) {
                        $allItems[] = [
                            ...$item,
                            'collection_name' =>
                            $collection['name'],
                            'collection_uuid' =>
                            $collection['uuid'],
                        ];
                    }
                }
            }

            $result = [
                'status' => 'success',
                'total_items' => count(
                    $allItems
                ),
                'results' => array_values(
                    $allItems
                ),
            ];

            Cache::put(
                $cacheKey,
                $result,
                now()->addMinutes(20)
            );

            return response()->json($result);
        } catch (\Exception $e) {
            return response()->json(
                [
                    'status' => 'error',
                    'message' =>
                    $e->getMessage(),
                ],
                500
            );
        }
    }
}
