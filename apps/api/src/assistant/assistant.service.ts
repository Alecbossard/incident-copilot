import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// use Node 18+/20 global fetch (declare for TS)
declare const fetch: any;

@Injectable()
export class AssistantService {
    private readonly logger = new Logger(AssistantService.name);

    constructor(private readonly prisma: PrismaService) {}

    async query(question: string): Promise<{ reply: string }> {
        const q = (question ?? '').toString().trim();

        // Fetch last incidents to give context to the LLM
        const incidents = await this.prisma.incident.findMany({
            select: {
                id: true,
                title: true,
                description: true,
                status: true,
                severity: true,
                createdAt: true,
            },
            orderBy: { createdAt: 'desc' },
            take: 50,
        });

        const aiBase = process.env.AI_BASE || 'http://ai:8000';

        const payload = {
            question: q,
            incidents: incidents.map((it) => ({
                id: it.id,
                title: it.title,
                description: it.description,
                status: it.status,
                severity: it.severity,
                createdAt: it.createdAt.toISOString(),
            })),
        };

        this.logger.log(
            `Calling AI assistant at ${aiBase}/assistant/query with question="${q}" and ${incidents.length} incidents`,
        );

        try {
            const res = await fetch(`${aiBase}/assistant/query`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                const text = await res.text().catch(() => '');
                this.logger.error(
                    `AI assistant error ${res.status}: ${text || '<no-body>'}`,
                );
                return {
                    reply:
                        'AI assistant temporarily unavailable (error from AI service). ' +
                        'You can still ask a human, or try again later.',
                };
            }

            const data = (await res.json().catch(() => null)) as
                | { reply?: string }
                | null;

            const reply =
                data?.reply ??
                'AI assistant: no reply returned by the AI service (missing "reply" field).';

            return { reply };
        } catch (e: any) {
            this.logger.error(`AI assistant call failed: ${e?.message ?? e}`);
            return {
                reply:
                    'AI assistant unavailable (connection error to AI service). ' +
                    'Please check the "ai" container and the AI_BASE environment variable.',
            };
        }
    }
}
