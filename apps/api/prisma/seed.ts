import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const now = new Date();
    const minus = (hrs: number) => new Date(now.getTime() - hrs * 3600 * 1000);

    await prisma.incident.createMany({
        data: [
            { title: 'Ping API down on EU-West', description: '5xx spike on EU-West API pods', status: 'OPEN', severity: 'SEV2', createdAt: minus(1) },
            { title: '[SEV5] Minor UI bug', description: 'Typos in dashboard legend', status: 'CLOSED', severity: 'SEV5', createdAt: minus(4) },
            { title: '[SEV4] Analytics delay', description: 'ETL lag of 20 minutes', status: 'RESOLVED', severity: 'SEV4', createdAt: minus(24) },
            { title: 'Billing spike check', description: 'Unexpected volume on invoices', status: 'MITIGATING', severity: 'SEV3', createdAt: minus(30) },
            { title: 'Auth latency alert', description: 'Login p95 > 900ms', status: 'ACKNOWLEDGED', severity: 'SEV2', createdAt: minus(48) },
        ],
        skipDuplicates: true,
    });
}

main().then(async () => {
    await prisma.$disconnect();
    console.log('Seed done.');
}).catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
});
