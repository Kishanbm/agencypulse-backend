import { AgencyPlan } from '@prisma/client';

/**
 * Per-plan usage limits.
 * AGENCY_PRO has Infinity — no limit query needed on hot paths.
 *
 * Plan mapping:
 *   FREELANCER  → Entry tier (14-day trial for new agencies)
 *   AGENCY      → Mid tier (paid)
 *   AGENCY_PRO  → Unlimited
 */
export interface PlanLimits {
  maxClients: number;
  maxStaff: number;
  maxIntegrationsPerCampaign: number;
  monthlyPriceUsd: number;
  displayName: string;
}

export const PLAN_LIMITS: Record<AgencyPlan, PlanLimits> = {
  FREELANCER: {
    maxClients: 2,
    maxStaff: 1,
    maxIntegrationsPerCampaign: 2,
    monthlyPriceUsd: 0,
    displayName: 'Freelancer',
  },
  AGENCY: {
    maxClients: 20,
    maxStaff: 10,
    maxIntegrationsPerCampaign: 10,
    monthlyPriceUsd: 79,
    displayName: 'Agency',
  },
  AGENCY_PRO: {
    maxClients: Number.POSITIVE_INFINITY,
    maxStaff: Number.POSITIVE_INFINITY,
    maxIntegrationsPerCampaign: Number.POSITIVE_INFINITY,
    monthlyPriceUsd: 179,
    displayName: 'Agency Pro',
  },
};

/** Maps a Stripe priceId (env var) to the AgencyPlan it grants. */
export function planFromPriceId(priceId: string, priceIds: {
  agency?: string;
  agencyPro?: string;
}): AgencyPlan {
  if (priceId === priceIds.agencyPro) return AgencyPlan.AGENCY_PRO;
  if (priceId === priceIds.agency) return AgencyPlan.AGENCY;
  return AgencyPlan.FREELANCER;
}

export type BillableResource = 'clients' | 'staff' | 'integrations';
