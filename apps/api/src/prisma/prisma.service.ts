import { INestApplication, Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
    async onModuleInit() {
        await this.$connect();
    }

    async onModuleDestroy() {
        // appelé quand Nest s’arrête proprement
        await this.$disconnect();
    }

    // Optionnel : helper si tu veux appeler depuis main.ts
    async enableShutdownHooks(app: INestApplication) {
        // Plus de this.$on('beforeExit') ici
        // On délègue à Nest (voir main.ts ci-dessous)
    }
}
