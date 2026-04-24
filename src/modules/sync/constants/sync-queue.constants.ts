import { IntegrationPlatform } from '@prisma/client';

/** Single queue — all integration sync jobs flow through this */
export const SYNC_QUEUE = 'integration-sync';

/**
 * Maps IntegrationPlatform enum to BullMQ job names.
 * Only platforms with a registered processor appear here.
 * Platforms added later (LinkedIn, SEMrush, etc.) are added to this map
 * alongside their processor.
 */
export const SYNC_JOB_NAMES: Partial<Record<IntegrationPlatform, string>> = {
  [IntegrationPlatform.GA4]:         'ga4-sync',
  [IntegrationPlatform.GOOGLE_ADS]:  'google-ads-sync',
  [IntegrationPlatform.META_ADS]:    'meta-ads-sync',
};
