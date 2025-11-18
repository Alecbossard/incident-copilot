'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useMemo } from 'react';
import UpdateStatusButton from './UpdateStatusButton';

const STATUS = ['OPEN', 'ACKNOWLEDGED', 'MITIGATING', 'RESOLVED', 'CLOSED'] as const;
type Status = typeof STATUS[number];

type Incident = {
    id: string;
    title: string;
    status: Status;
    severity: string;
    createdAt: string;
};

export default function IncidentsClient(props: {
    items: Incident[];
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
}) {
    const { items, page, total, totalPages } = props;
    const router = useRouter();
    const sp = useSearchParams();

    // helpers URL
    const setParam = (k: string, v?: string | null) => {
        const p = new URLSearchParams(sp?.toString() || '');
        if (v == null || v === '') p.delete(k);
        else p.set(k, v);
        // à chaque changement de filtre/tri/pageSize → on revient page 1
        p.set('page', '1');
        router.replace(`?${p.toString()}`, { scroll: false });
    };
    const get = (k: string, def = '') => sp.get(k) ?? def;

    // valeurs actuelles (URL)
    const q = get('q');
    const severity = get('severity', 'ALL');
    const sort = get('sort', 'createdAt') as 'createdAt' | 'title' | 'status' | 'severity';
    const dir = get('dir', 'desc') as 'asc' | 'desc';
    const statusParam = get('status', 'ALL');
    const pageSize = Number(get('pageSize', String(props.pageSize ?? 10))) || 10;

    const statuses = useMemo(
        () => (statusParam === 'ALL' ? 'ALL' : statusParam.split(',').filter(Boolean)),
        [statusParam]
    );

    // options de severities dynamiques depuis les données reçues
    const severityOptions = useMemo(() => {
        const set = new Set<string>();
        for (const i of items) if (i.severity) set.add(i.severity);
        return Array.from(set).sort();
    }, [items]);

    // actions UI
    const toggleStatus = (s: Status) => {
        if (statuses === 'ALL') {
            setParam('status', s);
            return;
        }
        const has = (statuses as string[]).includes(s);
        const next = has ? (statuses as string[]).filter((x) => x !== s) : [...(statuses as string[]), s];
        setParam('status', next.length ? next.join(',') : null);
    };

    const setAllStatus = (on: boolean) => setParam('status', on ? null : '');

    const setDir = () => setParam('dir', dir === 'asc' ? 'desc' : 'asc');
    const setSort = (val: string) => setParam('sort', val);
    const setSeverity = (val: string) => setParam('severity', val === 'ALL' ? null : val);
    const setQ = (val: string) => setParam('q', val.trim() === '' ? null : val.trim());
    const setPageSize = (val: number) => setParam('pageSize', String(val));

    const goPage = (p: number) => {
        const params = new URLSearchParams(sp?.toString() || '');
        params.set('page', String(p));
        router.replace(`?${params.toString()}`, { scroll: false });
    };

    const reset = () =>
        router.replace('?sort=createdAt&dir=desc&page=1&pageSize=10', { scroll: false });

    // Calcul du range X–Y sur Total
    const startIdx = total === 0 ? 0 : (page - 1) * pageSize + 1;
    const endIdx = Math.min(page * pageSize, total);

    return (
        <div>
            {/* Contrôles */}
            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr',
                    gap: '0.75rem',
                    marginBottom: '0.75rem',
                }}
            >
                {/* Status multi-sélection */}
                <div>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>Status</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
                        <label>
                            <input
                                type="checkbox"
                                checked={statuses === 'ALL'}
                                onChange={(e) => setAllStatus(e.target.checked)}
                            />{' '}
                            All
                        </label>
                        {STATUS.map((s) => (
                            <label key={s}>
                                <input
                                    type="checkbox"
                                    checked={statuses === 'ALL' ? false : (statuses as string[]).includes(s)}
                                    onChange={() => toggleStatus(s)}
                                />{' '}
                                {s}
                            </label>
                        ))}
                    </div>
                </div>

                {/* Severity */}
                <label>
                    <span style={{ fontWeight: 600, marginRight: 6 }}>Severity</span>
                    <select value={severity} onChange={(e) => setSeverity(e.target.value)}>
                        <option value="ALL">All</option>
                        {severityOptions.map((s) => (
                            <option key={s} value={s}>
                                {s}
                            </option>
                        ))}
                    </select>
                </label>

                {/* Search */}
                <label>
                    <span style={{ fontWeight: 600, marginRight: 6 }}>Search title</span>
                    <input
                        defaultValue={q}
                        onBlur={(e) => setQ(e.target.value)}
                        placeholder="type then blur…"
                        style={{ padding: '0.25rem 0.5rem', width: 260 }}
                    />
                </label>

                {/* Tri + Page size */}
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <label>
                        <span style={{ fontWeight: 600, marginRight: 6 }}>Sort by</span>
                        <select value={sort} onChange={(e) => setSort(e.target.value)}>
                            <option value="createdAt">createdAt</option>
                            <option value="title">title</option>
                            <option value="status">status</option>
                            <option value="severity">severity</option>
                        </select>
                    </label>

                    <button onClick={setDir}>Direction: {dir.toUpperCase()}</button>

                    <label style={{ marginLeft: 8 }}>
                        <span style={{ fontWeight: 600, marginRight: 6 }}>Page size</span>
                        <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}>
                            <option value={10}>10</option>
                            <option value={20}>20</option>
                            <option value={50}>50</option>
                        </select>
                    </label>

                    <button onClick={reset} title="Réinitialiser">
                        Reset
                    </button>
                </div>
            </div>

            {/* Liste */}
            <ul style={{ listStyle: 'none', padding: 0 }}>
                {items.length === 0 && <li style={{ opacity: 0.7 }}>Aucun incident</li>}
                {items.map((i) => (
                    <li
                        key={i.id}
                        style={{
                            display: 'flex',
                            gap: '0.5rem',
                            alignItems: 'center',
                            padding: '0.5rem 0',
                            borderBottom: '1px solid #3333',
                        }}
                    >
                        <span style={{ minWidth: 140 }}>{i.title}</span>
                        <span style={{ minWidth: 130 }}>status: {i.status}</span>
                        <span style={{ minWidth: 80 }}>sev: {i.severity}</span>
                        <span style={{ opacity: 0.7 }}>{new Date(i.createdAt).toLocaleString()}</span>
                        <span style={{ marginLeft: 'auto' }}>
              <UpdateStatusButton id={i.id} status={i.status} />
            </span>
                    </li>
                ))}
            </ul>

            {/* Pagination */}
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.75rem' }}>
                <button onClick={() => goPage(Math.max(1, page - 1))} disabled={page <= 1}>
                    Prev
                </button>

                <span>
          {total === 0 ? '0 sur 0' : `${startIdx}–${endIdx} sur ${total}`} — Page {page} /{' '}
                    {totalPages}
        </span>

                <button onClick={() => goPage(Math.min(totalPages, page + 1))} disabled={page >= totalPages}>
                    Next
                </button>
            </div>
        </div>
    );
}
