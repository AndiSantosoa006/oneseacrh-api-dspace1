import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Head } from '@inertiajs/react';

export default function Index() {
    /**
     * STATE
     */
    const [collections, setCollections] = useState([]);
    const [activeCollection, setActiveCollection] = useState(null);
    const [items, setItems] = useState([]);
    const [query, setQuery] = useState('');

    const [loadingCollections, setLoadingCollections] =
        useState(false);

    const [loadingItems, setLoadingItems] =
        useState(false);

    const [loadingCounts, setLoadingCounts] =
        useState(false);

    const [error, setError] = useState('');

    /**
     * PAGINATION
     */
    const [currentPage, setCurrentPage] = useState(1);

    const ITEMS_PER_PAGE = 10;

    /**
     * LOAD COLLECTIONS
     */
    useEffect(() => {
        fetchCollections();
    }, []);

    /**
     * UPDATE COUNTS
     */
    useEffect(() => {
        if (!collections.length) return;

        const debounce = setTimeout(() => {
            updateCollectionCounts(query);
        }, 400);

        return () => clearTimeout(debounce);
    }, [query]);

    /**
     * FETCH ITEMS
     */
    useEffect(() => {
        if (!activeCollection) return;

        const debounce = setTimeout(() => {
            fetchItems(activeCollection);
        }, 400);

        return () => clearTimeout(debounce);
    }, [activeCollection, query]);

    /**
     * RESET PAGE
     */
    useEffect(() => {
        setCurrentPage(1);
    }, [query, activeCollection]);

    /**
     * FETCH COLLECTIONS
     */
    const fetchCollections = async () => {
        setLoadingCollections(true);
        setError('');

        try {
            const { data } = await axios.get(
                '/api/collections'
            );

            if (data.status === 'success') {
                const formattedCollections = (
                    data.results || []
                ).map((collection) => ({
                    ...collection,
                    search_total: 0,
                }));

                setCollections(formattedCollections);

                if (formattedCollections.length > 0) {
                    setActiveCollection(
                        formattedCollections[0].uuid
                    );
                }
            }
        } catch (err) {
            console.error(err);
            setError(
                'Gagal mengambil data collections.'
            );
        } finally {
            setLoadingCollections(false);
        }
    };

    /**
     * FETCH ITEMS
     */
    const fetchItems = async (collectionUuid) => {
        setLoadingItems(true);
        setError('');

        try {
            const { data } = await axios.get(
                `/api/collections/${collectionUuid}/items`,
                {
                    params: {
                        q: query,
                    },
                }
            );

            if (data.status === 'success') {
                setItems(data.results || []);
            } else {
                setItems([]);
            }
        } catch (err) {
            console.error(err);
            setItems([]);
            setError(
                'Gagal mengambil data repository.'
            );
        } finally {
            setLoadingItems(false);
        }
    };

    /**
     * UPDATE COUNTS
     */
    const updateCollectionCounts = async (
        keyword = ''
    ) => {
        setLoadingCounts(true);

        try {
            const { data } = await axios.get(
                '/api/collections-counts',
                {
                    params: {
                        q: keyword,
                    },
                }
            );

            if (data.status === 'success') {
                const counts = data.results || [];

                setCollections((prevCollections) =>
                    prevCollections.map((collection) => {
                        const found = counts.find(
                            (count) =>
                                count.uuid ===
                                collection.uuid
                        );

                        return {
                            ...collection,
                            search_total:
                                found?.total_items || 0,
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

    /**
     * HIGHLIGHT TEXT
     */
    const highlightText = (text, keyword) => {
        if (!keyword || !text) return text;

        const escapedKeyword = keyword.replace(
            /[.*+?^${}()|[\]\\]/g,
            '\\$&'
        );

        const regex = new RegExp(
            `(${escapedKeyword})`,
            'gi'
        );

        return text.split(regex).map((part, index) =>
            regex.test(part) ? (
                <mark
                    key={index}
                    className="
                        bg-yellow-200
                        text-slate-900
                        rounded
                        px-1
                    "
                >
                    {part}
                </mark>
            ) : (
                part
            )
        );
    };

    /**
     * ABSTRACT SNIPPET
     */
    const getAbstractSnippet = (
        abstract,
        keyword,
        maxLength = 180
    ) => {
        if (!abstract) return '';

        if (!keyword) {
            return abstract.length > maxLength
                ? `${abstract.substring(
                      0,
                      maxLength
                  )}...`
                : abstract;
        }

        const lowerAbstract =
            abstract.toLowerCase();

        const lowerKeyword =
            keyword.toLowerCase();

        const keywordIndex =
            lowerAbstract.indexOf(lowerKeyword);

        if (keywordIndex === -1) {
            return abstract.length > maxLength
                ? `${abstract.substring(
                      0,
                      maxLength
                  )}...`
                : abstract;
        }

        const start = Math.max(
            keywordIndex - 70,
            0
        );

        const end = Math.min(
            keywordIndex + 120,
            abstract.length
        );

        let snippet = abstract.substring(
            start,
            end
        );

        if (start > 0) {
            snippet = `...${snippet}`;
        }

        if (end < abstract.length) {
            snippet = `${snippet}...`;
        }

        return snippet;
    };

    /**
     * PAGINATION
     */
    const totalPages = Math.ceil(
        items.length / ITEMS_PER_PAGE
    );

    const paginatedItems = useMemo(() => {
        const start =
            (currentPage - 1) * ITEMS_PER_PAGE;

        const end = start + ITEMS_PER_PAGE;

        return items.slice(start, end);
    }, [items, currentPage]);

    return (
        <div className="min-h-screen bg-slate-100">
            <Head title="OneSearch" />

            <div className="mx-auto max-w-5xl px-4 py-8">
                {/* HEADER */}
                <div className="mb-8">
                    <h1 className="text-2xl font-semibold text-slate-800">
                        OneSearch
                    </h1>

                    <p className="mt-1 text-sm text-slate-500">
                        Repository Search Engine
                    </p>
                </div>

                {/* SEARCH */}
                <div className="mb-6">
                    <input
                        type="text"
                        placeholder="Cari repository..."
                        value={query}
                        onChange={(e) =>
                            setQuery(e.target.value)
                        }
                        className="
                            w-full
                            rounded-xl
                            border
                            border-slate-200
                            bg-white
                            px-4
                            py-3
                            text-sm
                            text-slate-700
                            outline-none
                            transition
                            focus:border-blue-500
                        "
                    />
                </div>

                {/* COLLECTIONS */}
                <div className="mb-6 overflow-x-auto">
                    {loadingCollections ? (
                        <div className="text-sm text-slate-500">
                            Loading...
                        </div>
                    ) : (
                        <div className="flex gap-2">
                            {collections
    .filter(
        (collection) => collection.search_total > 0
    )
    .map((collection) => {
                                    const isActive =
                                        activeCollection ===
                                        collection.uuid;

                                    return (
                                        <button
                                            key={
                                                collection.uuid
                                            }
                                            onClick={() =>
                                                setActiveCollection(
                                                    collection.uuid
                                                )
                                            }
                                            className={`
                                                flex
                                                items-center
                                                gap-2
                                                whitespace-nowrap
                                                rounded-xl
                                                border
                                                px-3
                                                py-2
                                                text-xs
                                                font-medium
                                                transition
                                                ${
                                                    isActive
                                                        ? 'border-blue-600 bg-blue-600 text-white'
                                                        : 'border-slate-200 bg-white text-slate-600 hover:border-blue-300'
                                                }
                                            `}
                                        >
                                            <span>
                                                {
                                                    collection.name
                                                }
                                            </span>

                                            <span
                                                className="
                                                    rounded-full
                                                    bg-black/10
                                                    px-2
                                                    py-0.5
                                                    text-[10px]
                                                "
                                            >
                                                {loadingCounts
                                                    ? '...'
                                                    : collection.search_total}
                                            </span>
                                        </button>
                                    );
                                }
                            )}
                        </div>
                    )}
                </div>

                {/* ERROR */}
                {error && (
                    <div
                        className="
                            mb-5
                            rounded-xl
                            border
                            border-red-200
                            bg-red-50
                            px-4
                            py-3
                            text-sm
                            text-red-600
                        "
                    >
                        {error}
                    </div>
                )}

                {/* LOADING */}
                {loadingItems && (
                    <div className="py-12 text-center">
                        <div
                            className="
                                mx-auto
                                h-7
                                w-7
                                animate-spin
                                rounded-full
                                border-2
                                border-blue-600
                                border-t-transparent
                            "
                        />

                        <p className="mt-3 text-sm text-slate-500">
                            Memuat repository...
                        </p>
                    </div>
                )}

                {/* EMPTY */}
                {!loadingItems &&
                    paginatedItems.length === 0 && (
                        <div
                            className="
                                rounded-2xl
                                border
                                border-slate-200
                                bg-white
                                px-6
                                py-10
                                text-center
                            "
                        >
                            <h2 className="text-sm font-medium text-slate-700">
                                Tidak ada hasil ditemukan
                            </h2>
                        </div>
                    )}

                {/* ITEMS */}
                {!loadingItems &&
                    paginatedItems.length > 0 && (
                        <>
                            <div className="space-y-3">
                                {paginatedItems.map(
                                    (item) => (
                                        <div
                                            key={
                                                item.uuid ||
                                                item.UUID
                                            }
                                            className="
                                                rounded-2xl
                                                border
                                                border-slate-200
                                                bg-white
                                                p-5
                                                transition
                                                hover:border-blue-200
                                            "
                                        >
                                            {/* TITLE */}
                                            <h2
                                                className="
                                                    text-sm
                                                    font-semibold
                                                    leading-6
                                                    text-slate-800
                                                "
                                            >
                                                {highlightText(
                                                    item.name,
                                                    query
                                                )}
                                            </h2>

                                            {/* ABSTRACT */}
                                            {item.abstract && (
                                                <p
                                                    className="
                                                        mt-2
                                                        text-sm
                                                        leading-6
                                                        text-slate-500
                                                    "
                                                >
                                                    {highlightText(
                                                        getAbstractSnippet(
                                                            item.abstract,
                                                            query
                                                        ),
                                                        query
                                                    )}
                                                </p>
                                            )}

                                            {/* FOOTER */}
                                            <div
                                                className="
                                                    mt-4
                                                    flex
                                                    items-center
                                                    justify-between
                                                    gap-3
                                                    border-t
                                                    border-slate-100
                                                    pt-3
                                                "
                                            >
                                                <span
                                                    className="
                                                        truncate
                                                        text-xs
                                                        text-slate-400
                                                    "
                                                >
                                                    {
                                                        item.handle
                                                    }
                                                </span>

                                                <a
                                                    href={`https://repository.ibrahimy.ac.id/handle/${item.handle}`}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="
                                                        rounded-lg
                                                        border
                                                        border-slate-200
                                                        px-3
                                                        py-2
                                                        text-xs
                                                        font-medium
                                                        text-slate-700
                                                        transition
                                                        hover:border-blue-500
                                                        hover:text-blue-600
                                                    "
                                                >
                                                    Detail
                                                </a>
                                            </div>
                                        </div>
                                    )
                                )}
                            </div>

                            {/* PAGINATION */}
                            {totalPages > 1 && (
                                <div
                                    className="
                                        mt-8
                                        flex
                                        items-center
                                        justify-center
                                        gap-2
                                    "
                                >
                                    <button
                                        disabled={
                                            currentPage === 1
                                        }
                                        onClick={() =>
                                            setCurrentPage(
                                                (prev) =>
                                                    prev - 1
                                            )
                                        }
                                        className="
                                            rounded-lg
                                            border
                                            border-slate-200
                                            bg-white
                                            px-3
                                            py-2
                                            text-xs
                                            text-slate-600
                                            disabled:opacity-50
                                        "
                                    >
                                        Prev
                                    </button>

                                    {[
                                        ...Array(
                                            totalPages
                                        ),
                                    ].map((_, index) => {
                                        const page =
                                            index + 1;

                                        return (
                                            <button
                                                key={page}
                                                onClick={() =>
                                                    setCurrentPage(
                                                        page
                                                    )
                                                }
                                                className={`
                                                    rounded-lg
                                                    px-3
                                                    py-2
                                                    text-xs
                                                    transition
                                                    ${
                                                        currentPage ===
                                                        page
                                                            ? 'bg-blue-600 text-white'
                                                            : 'border border-slate-200 bg-white text-slate-600'
                                                    }
                                                `}
                                            >
                                                {page}
                                            </button>
                                        );
                                    })}

                                    <button
                                        disabled={
                                            currentPage ===
                                            totalPages
                                        }
                                        onClick={() =>
                                            setCurrentPage(
                                                (prev) =>
                                                    prev + 1
                                            )
                                        }
                                        className="
                                            rounded-lg
                                            border
                                            border-slate-200
                                            bg-white
                                            px-3
                                            py-2
                                            text-xs
                                            text-slate-600
                                            disabled:opacity-50
                                        "
                                    >
                                        Next
                                    </button>
                                </div>
                            )}
                        </>
                    )}
            </div>
        </div>
    );
}