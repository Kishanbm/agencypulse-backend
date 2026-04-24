import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bullmq';
import configuration from './config/configuration';
import { validateEnv } from './config/env.validation';
import { DatabaseModule } from './database/database.module';
import { TenantModule } from './common/tenant/tenant.module';
import { EncryptionModule } from './common/encryption/encryption.module';
import { StorageModule } from './common/storage/storage.module';
import { AuthModule } from './modules/auth/auth.module';
import { AgencyModule } from './modules/agency/agency.module';
import { TeamModule } from './modules/team/team.module';
import { ClientsModule } from './modules/clients/clients.module';
import { CampaignsModule } from './modules/campaigns/campaigns.module';
import { AssignmentsModule } from './modules/assignments/assignments.module';
import { IntegrationsModule } from './modules/integrations/integrations.module';
import { Ga4Module } from './modules/integrations/ga4/ga4.module';
import { GoogleAdsModule } from './modules/integrations/google-ads/google-ads.module';
import { MetaAdsModule } from './modules/integrations/meta-ads/meta-ads.module';
import { GscModule } from './modules/integrations/google-search-console/gsc.module';
import { YoutubeModule } from './modules/integrations/youtube/youtube.module';
import { LinkedinAdsModule } from './modules/integrations/linkedin-ads/linkedin-ads.module';
import { TiktokAdsModule } from './modules/integrations/tiktok-ads/tiktok-ads.module';
import { AmazonAdsModule } from './modules/integrations/amazon-ads/amazon-ads.module';
import { SyncModule } from './modules/sync/sync.module';
import { MetricsModule } from './modules/metrics/metrics.module';
import { DashboardsModule } from './modules/dashboards/dashboards.module';
import { ReportsModule } from './modules/reports/reports.module';
import { HealthModule } from './modules/health/health.module';
import { GoalsModule } from './modules/goals/goals.module';
import { ScorecardModule } from './modules/scorecard/scorecard.module';
import { NotesModule } from './modules/notes/notes.module';
import { AlertsModule } from './modules/alerts/alerts.module';
import { ForecastModule } from './modules/forecast/forecast.module';
import { KpiModule } from './modules/kpi/kpi.module';
import { ExportModule } from './modules/export/export.module';
import { BillingModule } from './modules/billing/billing.module';
import { TemplatesModule } from './modules/templates/templates.module';
import { AiModule } from './modules/ai/ai.module';
import { AuditModule } from './modules/audit/audit.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from './modules/auth/guards/roles.guard';

@Module({
  imports: [
    // Global config — validates env at startup, fails fast if required vars missing
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: '.env',
      validate: validateEnv,
    }),

    // Global rate limiter — per-route limits set via @Throttle() decorator
    // Default: 100 requests per 60 seconds (overridden on login/register routes)
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,  // 1 minute window (ms)
        limit: 100,   // default max requests per window
      },
    ]),

    // Cron scheduler — used by AuthCleanupTask and future maintenance jobs
    ScheduleModule.forRoot(),

    // BullMQ global Redis connection — shared by all queue modules (SyncModule, etc.)
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('redis.host'),
          port: config.get<number>('redis.port'),
          password: config.get<string>('redis.password'),
        },
      }),
    }),

    // TenantModule first — PrismaService depends on TenantContextService
    TenantModule,

    // Global database (PrismaService available everywhere)
    DatabaseModule,

    // Global encryption — EncryptionService used by IntegrationsService + future modules
    EncryptionModule,

    // Global object storage — S3-compatible, used by reports PDF upload/download
    StorageModule,

    // Auth — register, login, JWT, refresh tokens, RBAC guards
    AuthModule,

    // Phase 1.6 — Agency onboarding
    AgencyModule,
    TeamModule,

    // Phase 2.1 — Client management
    ClientsModule,

    // Phase 2.2 — Campaign CRUD
    CampaignsModule,

    // Phase 2.3 — Staff assignment management
    AssignmentsModule,

    // Phase 3.1 — Integration framework (OAuth token manager)
    IntegrationsModule,

    // Phase 3.2 — Google Analytics 4 OAuth + API client
    Ga4Module,

    // Phase 3.3 — Google Ads OAuth + API client
    GoogleAdsModule,

    // Phase 3.4 — Meta Ads OAuth + API client
    MetaAdsModule,

    // Phase 3.7 — Additional integration platforms
    GscModule,
    YoutubeModule,
    LinkedinAdsModule,
    TiktokAdsModule,
    AmazonAdsModule,

    // Phase 3.5 — BullMQ background job system (integration data sync)
    SyncModule,

    // Phase 4.1 — Metrics data model (time-series storage, definitions, query API)
    MetricsModule,

    // Phase 5.1 — Dashboard system (CRUD, widgets, batch data endpoint)
    DashboardsModule,

    // Phase 6.1 — Report system (CRUD, sections, schedules, delivery history)
    ReportsModule,

    // Phase 8.6 — Data Health Monitor
    HealthModule,

    // Phase 8.2 — Goal Tracking
    GoalsModule,

    // Phase 8.9 — Scorecard System
    ScorecardModule,

    // Phase 8.10 — Campaign Notes
    NotesModule,

    // Phase 8.1 — Alerts & Monitoring
    AlertsModule,

    // Phase 8.8 — ROI Forecasting
    ForecastModule,

    // Phase 8.3 — KPI Engine
    KpiModule,

    // Phase 8.7 — Data Export
    ExportModule,

    // Phase 8.12 — Billing (Stripe subscriptions + plan limit enforcement)
    BillingModule,

    // Phase 8.11 — Template Marketplace (dashboard + report templates)
    TemplatesModule,

    // Audit Log — immutable per-tenant mutation log, ADMIN-read endpoint
    AuditModule,

    // Notifications — per-user notification feed + SSE real-time stream
    NotificationsModule,

    // Phase 8.4 + 8.5 — AI Report Summary + AI Assistant (Campaign Q&A)
    AiModule,
  ],

  providers: [
    // ─── Global Guards (applied to every route in order) ───────────────────
    //
    // 1. ThrottlerGuard — rate limiting (checked first, cheapest)
    // 2. JwtAuthGuard   — JWT verification (@Public() routes are skipped)
    // 3. RolesGuard     — role hierarchy check (runs after user is set on req)
    //
    // Guard order matters: NestJS applies APP_GUARD providers in declaration order.
    // ThrottlerGuard first prevents auth DB queries on rate-limited requests.
    // JwtAuthGuard before RolesGuard because RolesGuard reads req.user set by JWT.
    //
    // Resource-level filtering (staff assignment, client ownership) is NOT done
    // here — that belongs in the service layer for each feature module.

    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule {}
