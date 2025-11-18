export function getApiBase() {
    const internal = process.env.API_BASE_INTERNAL;
    const pub = process.env.NEXT_PUBLIC_API_BASE;
    return typeof window === 'undefined' ? (internal || pub) : pub;
}
