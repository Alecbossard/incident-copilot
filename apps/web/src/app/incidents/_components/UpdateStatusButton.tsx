'use client';

import { useState } from 'react';

export type Status = 'OPEN' | 'ACKNOWLEDGED' | 'MITIGATING' | 'RESOLVED' | 'CLOSED';

type Props = {
    id: string;
    /** Nom historique utilisé par certains appels */
    current?: Status;
    /** Alias observé dans la liste (i.status) */
    status?: Status;
};

const NEXT_PUBLIC_API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:3001';
const API_KEY = process.env.NEXT_PUBLIC_API_KEY || process.env.API_KEY; // si exposé côté client, sinon SSR s’en charge

export default function UpdateStatusButton(props: Props) {
    const initial = props.current ?? props.status ?? 'OPEN';
    const [value, setValue] = useState<Status>(initial);
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    async function update(to: Status) {
        setLoading(true);
        setErr(null);
        try {
            const res = await fetch(`${NEXT_PUBLIC_API_BASE}/incidents/${props.id}`, {
                method: 'PATCH',
                headers: {
                    'content-type': 'application/json',
                    ...(API_KEY ? { 'x-api-key': API_KEY } : {}),
                },
                body: JSON.stringify({ status: to }),
            });
            if (!res.ok) {
                const t = await res.text().catch(() => '');
                throw new Error(`${res.status} ${res.statusText} ${t}`);
            }
            setValue(to);
        } catch (e: any) {
            setErr(e?.message ?? String(e));
        } finally {
            setLoading(false);
        }
    }

    const disabledByFlag = (process.env.NEXT_PUBLIC_ENABLE_STATUS_UPDATE || process.env.ENABLE_STATUS_UPDATE || 'false')
        .toLowerCase() !== 'true';

    return (
        <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
      <select
          value={value}
          onChange={(e) => setValue(e.target.value as Status)}
          disabled={loading || disabledByFlag}
      >
        <option value="OPEN">OPEN</option>
        <option value="ACKNOWLEDGED">ACKNOWLEDGED</option>
        <option value="MITIGATING">MITIGATING</option>
        <option value="RESOLVED">RESOLVED</option>
        <option value="CLOSED">CLOSED</option>
      </select>
      <button
          onClick={() => update(value)}
          disabled={loading || disabledByFlag}
      >
        {loading ? 'Updating…' : 'Update'}
      </button>
            {disabledByFlag && (
                <small style={{ opacity: 0.7 }}>status update disabled (ENABLE_STATUS_UPDATE=false)</small>
            )}
            {err && <small style={{ color: 'red' }}>{err}</small>}
    </span>
    );
}
