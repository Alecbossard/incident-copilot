import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthController } from './health/health.controller';
import { IncidentsModule } from './incidents/incidents.module';
import { PrismaModule } from './prisma/prisma.module';
import { APP_GUARD } from '@nestjs/core';
import { ApiKeyGuard } from './auth/api-key.guard';
import { AssistantModule } from './assistant/assistant.module';

@Module({
    imports: [PrismaModule, IncidentsModule, AssistantModule],
    controllers: [AppController, HealthController],
    providers: [
        AppService,
        { provide: APP_GUARD, useClass: ApiKeyGuard },
    ],
})
export class AppModule {}
