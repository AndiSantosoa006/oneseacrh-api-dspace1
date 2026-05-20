import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Head } from '@inertiajs/react';

export default function Index() {
    const [collections, setCollections] = useState([]);
    const [activeCollection, setActiveCollection] = useState('all');
    const [allItems, setAllItems] = useState([]);
    const [query, setQuery] = useState('');
    const [loadingCollections, setLoadingCollections] = useState(false);
    const [loadingItems, setLoadingItems] = useState(false);
    const [loadingCounts, setLoadingCounts] = useState(false);
    const [error, setError] = useState('');
    const [currentPage, setCurrentPage] = useState(1);

    const ITEMS_PER_PAGE = 10;

    useEffect(() => {
        fetchCollections();
    }, []);

    useEffect(() => {
        if (!collections.length) return;

        const debounce = setTimeout(() => {
            updateCollectionCounts(query);
            fetchAllItems(query);
        }, 400);

        return () => clearTimeout(debounce);
    }, [query, collections.length]);

    useEffect(() => {
        setCurrentPage(1);
    }, [query, activeCollection]);

    const keywords = useMemo(() => {
        return query.trim().split(/\s+/).filter(Boolean);
    }, [query]);

    const fetchCollections = async () => {
        setLoadingCollections(true);
        setError('');

        try {
            const { data } = await axios.get('/api/collections');

            if (data.status === 'success') {
                const formatted = data.results.map((collection) => ({
                    ...collection,
                    search_total: collection.total_items || 0,
                }));

                setCollections(formatted);

                fetchAllItems('');
            }
        } catch (err) {
            console.error(err);
            setError('Gagal mengambil collections.');
        } finally {
            setLoadingCollections(false);
        }
    };

    const fetchAllItems = async (keyword = '') => {
        setLoadingItems(true);
        setError('');

        try {
            let visibleCollections = collections;

            if (keyword.trim()) {
                visibleCollections = collections.filter(
                    (collection) => collection.search_total > 0
                );
            }

            const requests = visibleCollections.map((collection) =>
                axios.get(`/api/collections/${collection.uuid}/items`, {
                    params: { q: keyword },
                })
            );

            const responses = await Promise.all(requests);

            let mergedItems = [];

            responses.forEach((response, index) => {
                const collection = visibleCollections[index];
                const results = response.data.results || [];

                const mapped = results.map((item) => ({
                    ...item,
                    collection_name: collection.name,
                    collection_uuid: collection.uuid,
                }));

                mergedItems.push(...mapped);
            });

            setAllItems(mergedItems);
        } catch (err) {
            console.error(err);
            setError('Gagal mengambil repository.');
        } finally {
            setLoadingItems(false);
        }
    };

    const updateCollectionCounts = async (keyword = '') => {
        setLoadingCounts(true);

        try {
            const { data } = await axios.get('/api/collections-counts', {
                params: { q: keyword },
            });

            if (data.status === 'success') {
                const counts = data.results || [];

                setCollections((prev) =>
                    prev.map((collection) => {
                        const found = counts.find(
                            (count) => count.uuid === collection.uuid
                        );

                        return {
                            ...collection,
                            search_total: found?.total_items || 0,
                        };
                    })
                );
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoadingCounts(false);
        }
    };

    const highlightText = (text = '') => {
        if (!query.trim()) return text;

        let highlighted = text;

        keywords.forEach((word) => {
            const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

            const regex = new RegExp(`(${escaped})`, 'gi');

            highlighted = highlighted.replace(
                regex,
                '|||HIGHLIGHT|||$1|||END|||'
            );
        });

        return highlighted
            .split(/(\|\|\|HIGHLIGHT\|\|\|.*?\|\|\|END\|\|\|)/g)
            .map((part, index) => {
                if (part.startsWith('|||HIGHLIGHT|||')) {
                    const clean = part
                        .replace('|||HIGHLIGHT|||', '')
                        .replace('|||END|||', '');

                    return (
                        <mark
                            key={index}
                            className="rounded bg-yellow-200 px-1 text-slate-900"
                        >
                            {clean}
                        </mark>
                    );
                }

                return part;
            });
    };

    const getAbstractSnippet = (abstract = '', maxLength = 220) => {
        if (!query.trim()) {
            return abstract.length > maxLength
                ? `${abstract.substring(0, maxLength)}...`
                : abstract;
        }

        const lower = abstract.toLowerCase();

        let firstIndex = -1;

        keywords.forEach((word) => {
            const index = lower.indexOf(word.toLowerCase());

            if (index !== -1 && (firstIndex === -1 || index < firstIndex)) {
                firstIndex = index;
            }
        });

        if (firstIndex === -1) {
            return abstract.length > maxLength
                ? `${abstract.substring(0, maxLength)}...`
                : abstract;
        }

        const start = Math.max(firstIndex - 80, 0);
        const end = Math.min(firstIndex + 140, abstract.length);

        let snippet = abstract.substring(start, end);

        if (start > 0) snippet = `...${snippet}`;
        if (end < abstract.length) snippet = `${snippet}...`;

        return snippet;
    };

    const filteredItems = useMemo(() => {
        if (activeCollection === 'all') return allItems;

        return allItems.filter(
            (item) => item.collection_uuid === activeCollection
        );
    }, [allItems, activeCollection]);

    const totalPages = Math.ceil(filteredItems.length / ITEMS_PER_PAGE);

    const paginatedItems = useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        const end = start + ITEMS_PER_PAGE;

        return filteredItems.slice(start, end);
    }, [filteredItems, currentPage]);

    const groupedItems = useMemo(() => {
        const grouped = {};

        allItems.forEach((item) => {
            if (!grouped[item.collection_name]) {
                grouped[item.collection_name] = [];
            }

            grouped[item.collection_name].push(item);
        });

        return grouped;
    }, [allItems]);

    const renderCard = (item) => (
        <div
            key={item.uuid || item.UUID}
            className="rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-blue-200"
        >
            <h2 className="text-sm font-semibold leading-6 text-slate-800">
                {highlightText(item.name)}
            </h2>

            {item.abstract && (
                <p className="mt-2 text-sm leading-6 text-slate-500">
                    {highlightText(getAbstractSnippet(item.abstract))}
                </p>
            )}

            <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                <span className="truncate text-xs text-slate-400">
                    {item.handle}
                </span>

                <a
                    href={`https://repository.ibrahimy.ac.id/handle/${item.handle}`}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-600 transition hover:border-blue-500 hover:text-blue-600"
                >
                    Detail
                </a>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-slate-50">
            <Head title="OneSearch" />

            <div className="mx-auto max-w-5xl px-4 py-8">
                <div className="mb-8">
                    <h1 className="text-xl font-semibold text-slate-800">
                        OneSearch
                    </h1>

                    <p className="mt-1 text-sm text-slate-500">
                        Repository Search Engine
                    </p>
                </div>

                <div className="mb-6">
                    <input
                        type="text"
                        placeholder="Cari repository..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                </div>

                <div className="mb-8 overflow-x-auto">
                    <div className="flex gap-2">
                        <button
                            onClick={() => setActiveCollection('all')}
                            className={`rounded-xl border px-4 py-2 text-xs font-medium transition ${
                                activeCollection === 'all'
                                    ? 'border-blue-600 bg-blue-600 text-white'
                                    : 'border-slate-200 bg-white text-slate-600'
                            }`}
                        >
                            Semua
                        </button>

                        {collections
                            .filter((collection) =>
                                query.trim()
                                    ? collection.search_total > 0
                                    : collection.total_items > 0
                            )
                            .map((collection) => {
                                const isActive =
                                    activeCollection === collection.uuid;

                                return (
                                    <button
                                        key={collection.uuid}
                                        onClick={() =>
                                            setActiveCollection(collection.uuid)
                                        }
                                        className={`flex items-center gap-2 whitespace-nowrap rounded-xl border px-4 py-2 text-xs font-medium transition ${
                                            isActive
                                                ? 'border-blue-600 bg-blue-600 text-white'
                                                : 'border-slate-200 bg-white text-slate-600'
                                        }`}
                                    >
                                        <span>{collection.name}</span>

                                        <span className="rounded-full bg-black/10 px-2 py-0.5 text-[10px]">
                                            {loadingCounts
                                                ? '...'
                                                : query.trim()
                                                ? collection.search_total
                                                : collection.total_items}
                                        </span>
                                    </button>
                                );
                            })}
                    </div>
                </div>

                {error && (
                    <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                        {error}
                    </div>
                )}

                {loadingItems && (
                    <div className="py-14 text-center">
                        <div className="mx-auto h-7 w-7 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />

                        <p className="mt-4 text-sm text-slate-500">
                            Memuat repository...
                        </p>
                    </div>
                )}

                {!loadingItems && filteredItems.length === 0 && (
                    <div className="rounded-2xl border border-slate-200 bg-white px-6 py-10 text-center">
                        <p className="text-sm text-slate-500">
                            Tidak ada hasil ditemukan
                        </p>
                    </div>
                )}

                {!loadingItems && filteredItems.length > 0 && (
                    <>
                        {activeCollection === 'all' ? (
                            <div className="space-y-8">
                                {Object.entries(groupedItems).map(
                                    ([collectionName, collectionItems]) => (
                                        <div key={collectionName}>
                                            <div className="mb-4 flex items-center justify-between">
                                                <h2 className="text-sm font-semibold text-slate-700">
                                                    {collectionName}
                                                </h2>

                                                <span className="text-xs text-slate-400">
                                                    {collectionItems.length}{' '}
                                                    items
                                                </span>
                                            </div>

                                            <div className="space-y-3">
                                                {collectionItems.map(
                                                    renderCard
                                                )}
                                            </div>
                                        </div>
                                    )
                                )}
                            </div>
                        ) : (
                            <>
                                <div className="space-y-3">
                                    {paginatedItems.map(renderCard)}
                                </div>

                                {totalPages > 1 && (
                                    <div className="mt-8 flex items-center justify-center gap-2">
                                        <button
                                            disabled={currentPage === 1}
                                            onClick={() =>
                                                setCurrentPage((prev) => prev - 1)
                                            }
                                            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs text-slate-600 transition disabled:opacity-50"
                                        >
                                            Prev
                                        </button>

                                        {[...Array(totalPages)].map(
                                            (_, index) => {
                                                const page = index + 1;

                                                return (
                                                    <button
                                                        key={page}
                                                        onClick={() =>
                                                            setCurrentPage(page)
                                                        }
                                                        className={`rounded-xl px-4 py-2 text-xs transition ${
                                                            currentPage === page
                                                                ? 'bg-blue-600 text-white'
                                                                : 'border border-slate-200 bg-white text-slate-600'
                                                        }`}
                                                    >
                                                        {page}
                                                    </button>
                                                );
                                            }
                                        )}

                                        <button
                                            disabled={
                                                currentPage === totalPages
                                            }
                                            onClick={() =>
                                                setCurrentPage((prev) => prev + 1)
                                            }
                                            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs text-slate-600 transition disabled:opacity-50"
                                        >
                                            Next
                                        </button>
                                    </div>
                                )}
                            </>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}