import { Logger } from '@nestjs/common';

const log = new Logger('EnvCheck');

export function checkEnv() {
    const get = (k: string) => process.env[k]?.trim();

    const required = ['DATABASE_URL', 'API_KEY', 'CORS_ORIGIN'];
    for (const key of required) {
        if (!get(key)) {
            log.warn(`Missing ${key}. Some features may not work.`);
        }
    }

    // Embeddings
    const embFallback = (get('EMB_FALLBACK') || 'local').toLowerCase();
    if (!['local', 'none'].includes(embFallback)) {
        log.warn(`EMB_FALLBACK="${embFallback}" is not recognized. Use "local" or "none". Falling back to "local".`);
    }
    if (!get('GEMINI_API_KEY')) {
        if (embFallback === 'none') {
            log.warn('GEMINI_API_KEY is missing and EMB_FALLBACK=none → embeddings will fail.');
        } else {
            log.log('GEMINI_API_KEY missing — using local deterministic embedding fallback.');
        }
    }

    // Flags sécurité
    const allowPatch = (get('ALLOW_STATUS_PATCH') || 'false').toLowerCase();
    if (allowPatch !== 'true') {
        log.log('ALLOW_STATUS_PATCH=false — PATCH /incidents/:id is disabled (server policy).');
    } else {
        log.warn('ALLOW_STATUS_PATCH=true — status updates are enabled.');
    }

    // CORS
    const cors = get('CORS_ORIGIN');
    if (cors) {
        log.log(`CORS_ORIGIN=${cors}`);
    } else {
        log.warn('CORS_ORIGIN not set — CORS may be too permissive or blocked.');
    }
}
