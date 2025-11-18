// apps/web/src/lib/api.ts

export function getApiBase() {
    // SSR (côté serveur dans Docker)
    if (typeof window === 'undefined') {
        return process.env.API_BASE_INTERNAL ?? 'http://api:3001';
    }

    // Côté navigateur
    return process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3001';
}

export function getApiKey() {
    // API_KEY est dispo côté serveur (SSR uniquement)
    return process.env.API_KEY ?? '';
}
