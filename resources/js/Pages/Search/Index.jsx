import { useEffect, useState } from 'react';
import axios from 'axios';
import { Head } from '@inertiajs/react';

export default function Index() {

    const [collections, setCollections] = useState([]);
    const [activeCollection, setActiveCollection] = useState(null);

    const [items, setItems] = useState([]);

    const [query, setQuery] = useState('');

    const [loading, setLoading] = useState(false);

    useEffect(() => {

        fetchCollections();

    }, []);

    useEffect(() => {

        if (activeCollection) {

            fetchItems(activeCollection);

        }

    }, [activeCollection, query]);

    const fetchCollections = async () => {

        try {

            const response = await axios.get('/api/collections');

            if (response.data.status === 'success') {

                setCollections(response.data.results);

                if (response.data.results.length > 0) {

                    setActiveCollection(
                        response.data.results[0].uuid
                    );

                }

            }

        } catch (error) {

            console.error(error);

        }
    };

    const fetchItems = async (uuid) => {

        setLoading(true);

        try {

            const response = await axios.get(
                `/api/collections/${uuid}/items`,
                {
                    params: {
                        q: query
                    }
                }
            );

            if (response.data.status === 'success') {

                setItems(response.data.results);

            }

        } catch (error) {

            console.error(error);

        } finally {

            setLoading(false);

        }
    };

    return (

        <div className="min-h-screen bg-slate-50 p-6">

            <Head title="OneSearch" />

            <div className="max-w-7xl mx-auto">

                <h1 className="text-4xl font-bold mb-8">
                    One<span className="text-blue-600">Search</span>
                </h1>

                <input
                    type="text"
                    placeholder="Cari dokumen..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="w-full mb-6 border border-slate-300 rounded-xl px-4 py-3"
                />

                <div className="flex flex-wrap gap-2 mb-8">

                    {collections.map((collection) => (

                        <button
                            key={collection.uuid}
                            onClick={() => setActiveCollection(collection.uuid)}
                            className={`px-4 py-2 rounded-xl text-sm font-medium transition

                            ${
                                activeCollection === collection.uuid
                                ? 'bg-blue-600 text-white'
                                : 'bg-white border'
                            }`}
                        >
                            {collection.name}
                        </button>

                    ))}

                </div>

                {loading && (

                    <div className="text-center py-10">
                        Loading...
                    </div>

                )}

                <div className="grid gap-4">

                    {items.map((item) => (

                        <div
                            key={item.uuid || item.UUID}
                            className="bg-white rounded-2xl p-5 shadow-sm border"
                        >

                            <h2 className="text-lg font-bold mb-2">
                                {item.name}
                            </h2>
                            {item.abstract && (

    <p className="text-sm text-slate-600 leading-relaxed mb-4">
        {item.abstract.substring(0, 300)}...
    </p>

)}

                            <div className="text-sm text-slate-500 mb-3">
                                {item.handle}
                            </div>

                            <a
                                href={`https://repository.ibrahimy.ac.id/handle/${item.handle}`}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-block bg-blue-600 text-white px-4 py-2 rounded-lg text-sm"
                            >
                                Lihat Repository
                            </a>

                        </div>

                    ))}

                </div>

            </div>

        </div>
    );
}
