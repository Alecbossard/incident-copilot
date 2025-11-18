import {
    ConflictException,
    Injectable,
    Logger,
    NotFoundException,
} from '@nestjs/common';
import { Prisma, Incident } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { Status } from './dto/update-status.dto';
import { ChatRequestDto, ChatResponseDto } from './dto/chat-incident.dto';

// on utilise le fetch global de Node 18+/20, on le déclare pour TypeScript
declare const fetch: any;

type ListParams = {
    statuses: string[] | null;
    severities: string[] | null;
    q: string | null;
    sort: 'createdAt' | 'title' | 'status' | 'severity';
    dir: 'asc' | 'desc';
    page: number;
    pageSize: number;
};

type SuggestResult = {
    summary: string;
    suggestedTitle: string;
    impactSummary: string;
    actionItems: string[];
    severityProposed: 'SEV1' | 'SEV2' | 'SEV3' | 'SEV4' | 'SEV5';
    statusProposed: 'OPEN' | 'ACKNOWLEDGED';
    tags: string[];
    confidence: number;
};

const ORDER: Status[] = ['OPEN', 'ACKNOWLEDGED', 'MITIGATING', 'RESOLVED', 'CLOSED'];
const allowedNext = new Map<Status, Status[]>([
    ['OPEN', ['ACKNOWLEDGED']],
    ['ACKNOWLEDGED', ['MITIGATING']],
    ['MITIGATING', ['RESOLVED']],
    ['RESOLVED', ['CLOSED']],
    ['CLOSED', ['CLOSED']],
]);

// Dimension de l'embedding local (bag-of-words)
const EMB_DIM = 768;

@Injectable()
export class IncidentsService {
    private readonly logger = new Logger(IncidentsService.name);

    constructor(private readonly prisma: PrismaService) {}

    // ---------- LIST (server-side pagination + filters) ----------
    async listServer(params: ListParams) {
        const page =
            Number.isFinite(params.page) && params.page >= 1 ? params.page : 1;
        const pageSize =
            Number.isFinite(params.pageSize) &&
            params.pageSize >= 1 &&
            params.pageSize <= 100
                ? params.pageSize
                : 20;
        const skip = (page - 1) * pageSize;
        const take = pageSize;

        const where: Prisma.IncidentWhereInput = {};

        if (params.statuses?.length) {
            where.status = { in: params.statuses as any[] };
        }

        if (params.severities?.length) {
            where.severity = { in: params.severities as any[] };
        }

        if (params.q?.trim()) {
            const q = params.q.trim();
            where.OR = [
                { title: { contains: q, mode: 'insensitive' } },
                { description: { contains: q, mode: 'insensitive' } },
            ];
        }

        const orderBy: Prisma.IncidentOrderByWithRelationInput = {
            [params.sort]: params.dir,
        } as Prisma.IncidentOrderByWithRelationInput;

        try {
            const [total, items] = await this.prisma.$transaction([
                this.prisma.incident.count({ where }),
                this.prisma.incident.findMany({ where, orderBy, skip, take }),
            ]);
            const totalPages = Math.max(1, Math.ceil(total / pageSize));
            return { items, page, pageSize, total, totalPages };
        } catch (e: any) {
            this.logger.error(
                `listServer failed with params=${JSON.stringify({
                    ...params,
                    page,
                    pageSize,
                })}`,
            );
            this.logger.error(e?.message ?? e);
            throw e;
        }
    }

    // ---------- CRUD ----------
    list() {
        return this.prisma.incident.findMany({
            orderBy: { createdAt: 'desc' },
        });
    }

    async findOne(id: string): Promise<Incident> {
        const incident = await this.prisma.incident.findUnique({
            where: { id },
        });

        if (!incident) {
            throw new NotFoundException('Incident not found');
        }

        return incident;
    }

    async create(dto: {
        title: string;
        description?: string;
        severity?: string;
        status?: string;
    }) {
        const created = await this.prisma.incident.create({
            data: {
                title: dto.title,
                description: dto.description ?? null,
                severity: (dto.severity ?? 'SEV3') as any,
                status: (dto.status ?? 'OPEN') as any,
            },
        });

        // Auto-embedding (fire-and-forget)
        this.upsertEmbeddingForIncident(created.id).catch((e) =>
            this.logger.warn(
                `auto-embed failed for ${created.id}: ${e?.message ?? e}`,
            ),
        );

        return created;
    }

    async updateStatus(id: string, status: Status) {
        try {
            const current = await this.prisma.incident.findUnique({
                where: { id },
                select: { status: true },
            });
            if (!current) throw new NotFoundException('Incident not found');
            const from = current.status as Status;
            const to = status;

            if (from === to) {
                return await this.prisma.incident.update({
                    where: { id },
                    data: { status: to },
                });
            }
            const allowed = allowedNext.get(from) ?? [];
            if (!allowed.includes(to)) {
                throw new ConflictException(
                    `Illegal transition: ${from} -> ${to} not allowed`,
                );
            }
            return await this.prisma.incident.update({
                where: { id },
                data: { status: to },
            });
        } catch (e: any) {
            if (e instanceof NotFoundException || e instanceof ConflictException)
                throw e;
            if (
                e instanceof Prisma.PrismaClientKnownRequestError &&
                e.code === 'P2025'
            ) {
                throw new NotFoundException('Incident not found');
            }
            this.logger.error(
                `updateStatus failed for id=${id} to status=${status}: ${
                    e?.message ?? e
                }`,
            );
            throw e;
        }
    }

    // ---------- SUGGEST (heuristique locale + IA Python/OpenAI) ----------
    private suggestHeuristic(title: string, description: string): SuggestResult {
        const text = `${title} ${description}`.toLowerCase();

        let severityProposed: 'SEV1' | 'SEV2' | 'SEV3' | 'SEV4' | 'SEV5' = 'SEV3';
        if (/\b(sev1|p1|major outage|data loss)\b/.test(text)) {
            severityProposed = 'SEV1';
        } else if (/\b(sev2|p2|outage|5xx|downtime|critical)\b/.test(text)) {
            severityProposed = 'SEV2';
        } else if (/\b(sev4|minor|degraded)\b/.test(text)) {
            severityProposed = 'SEV4';
        } else if (/\b(sev5|cosmetic|typo|ui)\b/.test(text)) {
            severityProposed = 'SEV5';
        }

        const tags = Array.from(
            new Set(
                [
                    /\b(api|billing|auth|db|cache|queue|cdn|network|eu[- ]?west|us[- ]?east|latency|5xx|timeout)\b/g,
                ].flatMap((re) =>
                    Array.from(text.matchAll(re)).map((m) => m[0].toLowerCase()),
                ),
            ),
        ).slice(0, 8);

        const baseSummary =
            `- ${title}\n` +
            (description?.trim()
                ? `- Description: ${description.trim().slice(0, 240)}${
                    description.length > 240 ? '…' : ''
                }\n`
                : '') +
            `- Proposed severity: ${severityProposed}`;

        const statusProposed: 'OPEN' | 'ACKNOWLEDGED' = 'OPEN';

        const safeTitle = title?.trim() || 'Incident (titre à préciser)';
        const impactSummary =
            description?.trim()
                ? `Impact probable : ${description.trim().slice(0, 180)}${
                    description.length > 180 ? '…' : ''
                }`
                : "Impact à préciser (collecter plus d'informations sur les services et utilisateurs affectés).";

        const actionItems = [
            "Vérifier les métriques et logs pertinents autour de l'heure de l'incident.",
            "Qualifier l'impact (services, régions, types d'utilisateurs touchés).",
            'Mettre en place une mitigation court terme si possible.',
            "Communiquer régulièrement le statut à l'équipe et aux parties prenantes.",
        ];

        return {
            summary: baseSummary,
            suggestedTitle: safeTitle,
            impactSummary,
            actionItems,
            severityProposed,
            statusProposed,
            tags,
            confidence: 0.55,
        };
    }

    async suggest(title: string, description: string): Promise<SuggestResult> {
        const heuristic = this.suggestHeuristic(title, description);
        const aiBase = process.env.AI_BASE || 'http://ai:8000';

        try {
            const res = await fetch(`${aiBase}/incident-suggest`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    title,
                    description,
                    heuristic,
                }),
            });

            if (!res.ok) {
                const text = await res.text().catch(() => '');
                this.logger.warn(
                    `AI suggest error ${res.status}: ${text || '<no-body>'}`,
                );
                return heuristic;
            }

            const data = (await res.json().catch(() => null)) as any;
            if (!data || typeof data !== 'object') {
                this.logger.warn('AI suggest returned invalid JSON');
                return heuristic;
            }

            return {
                summary: data.summary ?? heuristic.summary,
                suggestedTitle: data.suggestedTitle ?? heuristic.suggestedTitle,
                impactSummary: data.impactSummary ?? heuristic.impactSummary,
                actionItems: Array.isArray(data.actionItems)
                    ? data.actionItems.filter((x: any) => typeof x === 'string')
                    : heuristic.actionItems,
                severityProposed:
                    data.severityProposed ?? heuristic.severityProposed,
                statusProposed:
                    data.statusProposed ?? heuristic.statusProposed,
                tags: Array.isArray(data.tags)
                    ? data.tags.filter((x: any) => typeof x === 'string')
                    : heuristic.tags,
                confidence:
                    typeof data.confidence === 'number'
                        ? data.confidence
                        : heuristic.confidence,
            };
        } catch (e: any) {
            this.logger.error(`AI suggest call failed: ${e?.message ?? e}`);
            return heuristic;
        }
    }

    // =========================================================
    // =============  Embedding local (768D)  ==================
    // =========================================================

    private computeEmbeddingLocal(text: string, dim = EMB_DIM): number[] {
        const tokens = (text || '')
            .toLowerCase()
            .replace(/[^\p{L}\p{N}\s]/gu, ' ')
            .split(/\s+/)
            .filter(Boolean);

        const vec = new Array(dim).fill(0);
        for (const tok of tokens) {
            let h = 2166136261;
            for (let i = 0; i < tok.length; i++) {
                h ^= tok.charCodeAt(i);
                h = Math.imul(h, 16777619);
            }
            vec[Math.abs(h) % dim] += 1;
        }
        const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
        return vec.map((v) => v / norm);
    }

    // plus de Gemini ici : uniquement embedding local
    private async embedText(text: string): Promise<number[]> {
        const input = (text || '').slice(0, 8000);
        return this.computeEmbeddingLocal(input, EMB_DIM);
    }

    async upsertEmbeddingForIncident(id: string) {
        const incident = await this.prisma.incident.findUnique({
            where: { id },
            select: { id: true, title: true, description: true },
        });
        if (!incident) throw new NotFoundException('Incident not found');

        const text = `${incident.title}\n${incident.description ?? ''}`.trim();
        const vec = await this.embedText(text);
        const literal = `[${vec
            .map((x) => (Number.isFinite(x) ? x : 0))
            .join(',')}]`;

        try {
            await this.prisma.$executeRaw`
                UPDATE "Incident"
                SET embedding = ${literal}::vector
                WHERE id = ${id}
            `;
            return { ok: true };
        } catch (e: any) {
            this.logger.error(`DB vector update failed: ${e?.message ?? e}`);
            throw new Error(
                `DB vector update failed (check pgvector & dimension=${EMB_DIM}): ${
                    e?.message ?? e
                }`,
            );
        }
    }

    async similar(q: string, k: number = 5) {
        const text = (q || '').trim();
        if (!text)
            return { items: [] as Array<Incident & { score: number }> };

        const vec = await this.embedText(text);
        const literal = `[${vec
            .map((x) => (Number.isFinite(x) ? x : 0))
            .join(',')}]`;

        const rows: Array<Incident & { score: number }> =
            await this.prisma.$queryRaw<
                Array<Incident & { score: number }>
            >`
                SELECT id, title, description, status, severity, "createdAt",
                       (embedding <=> ${literal}::vector) AS score
                FROM "Incident"
                WHERE embedding IS NOT NULL
                ORDER BY embedding <=> ${literal}::vector
                    LIMIT ${k}
            `;
        return { items: rows };
    }

    async rebuildAllEmbeddings(batchSize = 25) {
        const all = await this.prisma.incident.findMany({
            select: { id: true, title: true, description: true },
            orderBy: { createdAt: 'desc' },
        });
        let ok = 0;
        for (let i = 0; i < all.length; i++) {
            try {
                await this.upsertEmbeddingForIncident(all[i].id);
                ok++;
            } catch (e) {
                this.logger.warn(
                    `Embedding failed for ${all[i].id}: ${e}`,
                );
            }
            if ((i + 1) % batchSize === 0)
                await new Promise((r) => setTimeout(r, 250));
        }
        return { total: all.length, ok };
    }

    // =========================================================
    // ================== CHAT (via service IA) =================
    // =========================================================
    async chat(id: string, body: ChatRequestDto): Promise<ChatResponseDto> {
        // 1) On récupère l'incident courant
        const incident = await this.prisma.incident.findUnique({
            where: { id },
            select: {
                id: true,
                title: true,
                description: true,
                status: true,
                severity: true,
                createdAt: true,
            },
        });
        if (!incident) {
            throw new NotFoundException('Incident not found');
        }

        // 2) On cherche des incidents similaires (via embeddings locaux)
        let similarForPayload: Array<{
            id: string;
            title: string;
            description: string | null;
            status: string;
            severity: string;
            score: number;
        }> = [];

        try {
            const queryText = `${incident.title}\n${incident.description ?? ''}`.trim();

            if (queryText) {
                const result = await this.similar(queryText, 5);

                this.logger.debug(
                    `similar() found ${result.items.length} incidents for id=${id}`,
                );

                similarForPayload = result.items
                    .filter((it) => it.id !== incident.id)
                    .slice(0, 3)
                    .map((it) => ({
                        id: it.id,
                        title: it.title,
                        description: it.description,
                        status: it.status,
                        severity: it.severity,
                        score: (it as any).score ?? 0,
                    }));
            }
        } catch (e: any) {
            this.logger.warn(
                `similar incidents fetch failed for id=${id}: ${e?.message ?? e}`,
            );
            similarForPayload = [];
        }

        const aiBase = process.env.AI_BASE || 'http://ai:8000';

        const payload = {
            incident: {
                id: incident.id,
                title: incident.title,
                description: incident.description,
                severity: incident.severity,
                status: incident.status,
            },
            similar_incidents: similarForPayload,
            messages: body.messages ?? [],
        };

        try {
            const res = await fetch(`${aiBase}/incident-chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                const text = await res.text().catch(() => '');
                this.logger.error(
                    `AI service error ${res.status}: ${
                        text || '<no-body>'
                    }`,
                );
                return {
                    reply:
                        'AI assistant is temporarily unavailable (error from the AI service). ' +
                        'You can still analyze the incident manually.',
                };
            }

            const data = (await res.json().catch(() => null)) as
                | { reply?: string }
                | null;

            const reply =
                data?.reply ||
                'IA: pas de réponse retournée par le service IA (champ reply manquant).';

            return { reply };
        } catch (e: any) {
            this.logger.error(
                `AI service call failed: ${e?.message ?? e}`,
            );
            return {
                reply:
                    'AI assistant is unavailable (cannot reach the AI service). ' +
                    'Check the "ai" container and the AI_BASE environment variable.',
            };
        }
    }

    // =========================================================
    // ================== SUMMARY (via Suggest/OpenAI) =========
    // =========================================================
    async summary(id: string) {
        const inc = await this.prisma.incident.findUnique({
            where: { id },
            select: {
                id: true,
                title: true,
                description: true,
                status: true,
                severity: true,
                createdAt: true,
            },
        });
        if (!inc) throw new NotFoundException('Incident not found');

        const result = await this.suggest(inc.title ?? '', inc.description ?? '');

        return {
            id: inc.id,
            summary: result.summary,
            severityProposed: result.severityProposed,
            statusProposed: result.statusProposed,
            tags: result.tags,
            confidence: result.confidence,
        };
    }
}
