const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: { db: { url: 'postgresql://agencypulse:1234@localhost:5433/agencypulse?schema=public' } }
});

const userId   = 'b333633b-66d4-492b-a136-49f08da144e8';
const tenantId = 'bfbcb52b-f98a-48ed-b30d-7a58158dc659';

const rows = [
  { type: 'REPORT_READY',    title: 'Report ready: Monthly Performance',       message: 'Your PDF report has been generated and is ready to download.',                              resource_type: 'Report',      is_read: false },
  { type: 'ALERT_TRIGGERED', title: 'Alert: Sessions dropped below threshold',  message: 'GA4 sessions fell below 100 for Test Campaign. Check your dashboard.',                    resource_type: 'Alert',       is_read: false },
  { type: 'SYNC_FAILED',     title: 'Sync failed: Google Ads',                  message: 'Failed to fetch data from Google Ads. Token may have expired — reconnect the integration.', resource_type: 'Integration', is_read: false },
  { type: 'SYNC_CONNECTED',  title: 'GA4 connected successfully',               message: 'Google Analytics 4 is now syncing data for Test Campaign.',                               resource_type: 'Integration', is_read: true  },
  { type: 'INVITE_ACCEPTED', title: 'Staff member accepted your invite',         message: 'staff1@test.com has joined your agency and can now access campaigns.',                    resource_type: 'User',        is_read: true  },
];

async function run() {
  for (const n of rows) {
    await prisma.$executeRawUnsafe(`
      INSERT INTO notifications (id, tenant_id, user_id, type, title, message, resource_type, is_read, created_at)
      VALUES (gen_random_uuid(), '${tenantId}'::uuid, '${userId}'::uuid, '${n.type}', '${n.title}', '${n.message}', '${n.resource_type}', ${n.is_read}, NOW())
    `);
    console.log('Inserted:', n.type);
  }
}

run().catch(console.error).finally(() => prisma.$disconnect());
