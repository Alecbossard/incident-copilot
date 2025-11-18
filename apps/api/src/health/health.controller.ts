import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Controller('health')
export class HealthController {
    constructor(private readonly prisma: PrismaService) {}

    @Get()
    async check() {
        const startedAt = Date.now();
        try {
            // ping DB
            await this.prisma.$queryRaw`SELECT 1`;
            const ms = Date.now() - startedAt;
            return { status: 'ok', db: 'up', dbLatencyMs: ms, uptimeSec: Math.floor(process.uptime()) };
        } catch {
            const ms = Date.now() - startedAt;
            return { status: 'degraded', db: 'down', dbLatencyMs: ms, uptimeSec: Math.floor(process.uptime()) };
        }
    }
}
