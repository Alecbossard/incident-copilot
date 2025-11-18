'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3001';

export default function CreateIncidentForm() {
    const router = useRouter();
    const [title, setTitle] = useState('');
    const [severity, setSeverity] = useState<'SEV1'|'SEV2'|'SEV3'|'SEV4'|'SEV5'>('SEV3');
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    async function onSubmit(e: FormEvent) {
        e.preventDefault();
        if (!title.trim()) return;
        setLoading(true);
        setErr(null);
        try {
            const res = await fetch(`${API}/incidents`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title, severity }),
            });
            if (!res.ok) {
                const t = await res.text();
                throw new Error(t || `HTTP ${res.status}`);
            }
            setTitle('');
            setSeverity('SEV3');
            // Recharge les données du Server Component
            router.refresh();
        } catch (e: any) {
            setErr(e.message ?? 'Error');
        } finally {
            setLoading(false);
        }
    }

    return (
        <form onSubmit={onSubmit} style={{ display: 'flex', gap: 8, margin: '16px 0' }}>
            <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Incident title"
                style={{ flex: 1, padding: 8 }}
            />
            <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value as any)}
                style={{ padding: 8 }}
            >
                <option value="SEV1">SEV1</option>
                <option value="SEV2">SEV2</option>
                <option value="SEV3">SEV3</option>
                <option value="SEV4">SEV4</option>
                <option value="SEV5">SEV5</option>
            </select>
            <button type="submit" disabled={loading} style={{ padding: '8px 16px' }}>
                {loading ? 'Creating…' : 'Create'}
            </button>
            {err && <span style={{ color: 'crimson', fontSize: 12 }}>{err}</span>}
        </form>
    );
}
