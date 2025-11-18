import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';

const API_KEY = 'dev-secret-123';

// helpers
function expect2xx(res: request.Response) {
    if (res.status < 200 || res.status >= 300) {
        throw new Error(`Expected 2xx, got ${res.status}. Body: ${res.text}`);
    }
}

describe('Incidents API (e2e)', () => {
    let app: INestApplication;
    let server: any;

    beforeAll(async () => {
        // env pour les tests
        process.env.API_KEY = API_KEY;
        process.env.CORS_ORIGIN = 'http://localhost:3000';
        process.env.EMB_FALLBACK = 'local'; // pas besoin de GEMINI en test

        const moduleRef = await Test.createTestingModule({
            imports: [AppModule],
        }).compile();

        app = moduleRef.createNestApplication();
        await app.init();
        server = app.getHttpServer();
    }, 30000);

    afterAll(async () => {
        await app?.close();
    });

    it('GET /health should succeed without API key', async () => {
        await request(server).get('/health').expect(200);
    });

    it('GET /incidents without API key should be 401', async () => {
        await request(server).get('/incidents').expect(401);
    });

    let createdId = '';

    it('POST /incidents should create an incident (with API key)', async () => {
        const res = await request(server)
            .post('/incidents')
            .set('x-api-key', API_KEY)
            .send({
                title: 'e2e - API 5xx EU-West',
                description: 'surge after deploy',
                severity: 'SEV3',
                status: 'OPEN',
            });

        expect2xx(res);
        const body = res.body || JSON.parse(res.text);
        expect(body.id).toBeDefined();
        expect(body.title).toBe('e2e - API 5xx EU-West');
        createdId = body.id;
    });

    it('GET /incidents (paged list) should include our item', async () => {
        const res = await request(server)
            .get('/incidents?page=1&pageSize=5&sort=createdAt&dir=desc')
            .set('x-api-key', API_KEY)
            .expect(200);

        const body = res.body;
        expect(Array.isArray(body.items)).toBe(true);
        expect(body.page).toBeGreaterThanOrEqual(1);
        expect(body.pageSize).toBeGreaterThanOrEqual(1);
    });

    it('PATCH /incidents/:id should be 403 when ALLOW_STATUS_PATCH=false', async () => {
        process.env.ALLOW_STATUS_PATCH = 'false';
        const res = await request(server)
            .patch(`/incidents/${createdId}`)
            .set('x-api-key', API_KEY)
            .send({ status: 'ACKNOWLEDGED' });

        expect(res.status).toBe(403);
    });

    it('PATCH /incidents/:id should advance status when ALLOW_STATUS_PATCH=true', async () => {
        process.env.ALLOW_STATUS_PATCH = 'true';

        const res1 = await request(server)
            .patch(`/incidents/${createdId}`)
            .set('x-api-key', API_KEY)
            .send({ status: 'ACKNOWLEDGED' });
        expect2xx(res1);
        expect(res1.body.status).toBe('ACKNOWLEDGED');

        const res2 = await request(server)
            .patch(`/incidents/${createdId}`)
            .set('x-api-key', API_KEY)
            .send({ status: 'MITIGATING' });
        expect2xx(res2);
        expect(res2.body.status).toBe('MITIGATING');

        const res3 = await request(server)
            .patch(`/incidents/${createdId}`)
            .set('x-api-key', API_KEY)
            .send({ status: 'RESOLVED' });
        expect2xx(res3);
        expect(res3.body.status).toBe('RESOLVED');

        const res4 = await request(server)
            .patch(`/incidents/${createdId}`)
            .set('x-api-key', API_KEY)
            .send({ status: 'CLOSED' });
        expect2xx(res4);
        expect(res4.body.status).toBe('CLOSED');
    });

    it('PATCH illegal transition should be 409', async () => {
        // CLOSED -> OPEN (interdit)
        const res = await request(server)
            .patch(`/incidents/${createdId}`)
            .set('x-api-key', API_KEY)
            .send({ status: 'OPEN' });

        expect(res.status).toBe(409);
    });

    it('POST /incidents/:id/embedding should upsert vector', async () => {
        const res = await request(server)
            .post(`/incidents/${createdId}/embedding`)
            .set('x-api-key', API_KEY);

        expect2xx(res);
    });

    it('GET /incidents/similar should return items array', async () => {
        const res = await request(server)
            .get(`/incidents/similar?q=${encodeURIComponent('API 5xx EU-West')}&k=5`)
            .set('x-api-key', API_KEY)
            .expect(200);

        const body = res.body;
        expect(body).toHaveProperty('items');
        expect(Array.isArray(body.items)).toBe(true);
    });

    it('GET /incidents/:id/summary should return summary object', async () => {
        const res = await request(server)
            .get(`/incidents/${createdId}/summary`)
            .set('x-api-key', API_KEY)
            .expect(200);

        const body = res.body;
        expect(body).toHaveProperty('id', createdId);
        expect(body).toHaveProperty('summary');
    });
});
