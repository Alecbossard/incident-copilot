import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger, ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { checkEnv } from './util/env-check';

function parseCorsOrigins(input?: string) {
    if (!input) return [];
    return input
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
}

async function bootstrap() {
    const logger = new Logger('Bootstrap');

    // Vérifications env
    checkEnv();

    const app = await NestFactory.create(AppModule, { cors: false });

    // CORS depuis env (CSV)
    const origins = parseCorsOrigins(process.env.CORS_ORIGIN);
    app.enableCors({
        origin: origins.length ? origins : false, // false = disable if not provided
        credentials: true,
    });

    // Validation globale (DTO + transformation/clamp côté API)
    app.useGlobalPipes(
        new ValidationPipe({
            transform: true,
            whitelist: true,
            forbidNonWhitelisted: false,
            transformOptions: { enableImplicitConversion: true },
        }),
    );

    // Swagger (toujours activé pour l’instant)
    const config = new DocumentBuilder()
        .setTitle('Incident Co-Pilot API')
        .setDescription(
            'MVP API for incidents (CRUD, embeddings, similar, summary). ' +
            'Use the header `x-api-key: <your api key>` for protected routes.',
        )
        .setVersion('0.1.0')
        .addApiKey(
            { type: 'apiKey', name: 'x-api-key', in: 'header', description: 'API key for protected endpoints' },
            'x-api-key',
        )
        .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('docs', app, document, {
        swaggerOptions: {
            persistAuthorization: true,
        },
    });

    const port = Number(process.env.PORT || 3001);
    await app.listen(port, '0.0.0.0');


    logger.log(`API listening on http://localhost:${port}`);
    logger.log(`Swagger UI available at http://localhost:${port}/docs`);
}

bootstrap();
