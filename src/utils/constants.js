export const APP_NAME = 'SanaaDeck'

export const USER_ROLES = {
  CLIENT: 'client',
  CREATIVE: 'creative',
  ADMIN: 'admin',
  SUPER_ADMIN: 'super_admin',
}

// UI display values only — NOT authoritative for enforcement.
// The Cloud Function reads the live config from systemConfig/subscriptionTiers in Firestore.
// Keep display values in sync with that document when tiers change.
export const SUBSCRIPTION_TIERS = {
  STARTER: { key: 'starter', creditsPerMonth: 15, priceUsd: 349, activeRequestLimit: 1 },
  GROWTH: { key: 'growth', creditsPerMonth: 30, priceUsd: 599, activeRequestLimit: 2 },
  PRO: { key: 'pro', creditsPerMonth: 60, priceUsd: 899, activeRequestLimit: 3 },
}

export const TIER_BY_KEY = {
  starter: SUBSCRIPTION_TIERS.STARTER,
  growth: SUBSCRIPTION_TIERS.GROWTH,
  pro: SUBSCRIPTION_TIERS.PRO,
}

export const CLIENT_ACTIVE_REQUEST_LIMITS = {
  starter: SUBSCRIPTION_TIERS.STARTER.activeRequestLimit,
  growth: SUBSCRIPTION_TIERS.GROWTH.activeRequestLimit,
  pro: SUBSCRIPTION_TIERS.PRO.activeRequestLimit,
}

export const DELIVERABLE_OPTIONS = [
  { value: 'social_post', label: 'Social post' },
  { value: 'carousel', label: 'Carousel (3-5 slides)' },
  { value: 'flyer', label: 'Flyer' },
  { value: 'poster', label: 'Poster' },
  { value: 'brochure_4pg', label: 'Brochure (4 pages)' },
  { value: 'presentation_10slides', label: 'Presentation (10 slides)' },
  { value: 'logo_concepts', label: 'Logo concepts' },
  { value: 'mini_brand_guide', label: 'Mini brand guide' },
  { value: 'packaging', label: 'Packaging' },
  { value: 'motion_30sec', label: 'Motion 30 sec' },
]

export const COMPLEXITY_OPTIONS = [
  { value: 'standard', label: 'Standard' },
  { value: 'complex', label: 'Complex (+50%)' },
  { value: 'advanced', label: 'Advanced (+100%)' },
]

export const ACTIVE_PROJECT_STATUSES = [
  'pending_confirmation',
  'confirmed',
  'in_progress',
  'ready_for_qc',
  'client_review',
  'revision_requested',
]

export const ADMIN_MODULE_KEYS = [
  'overview',
  'finance',
  'operations',
  'users',
  'clients',
  'creatives',
  'projects',
  'credit_transactions',
  'payments_subscriptions',
  'notifications',
  'briefing_templates',
  'image_moderation',
  'reports',
  'admins',
]

export const ADMIN_ACTION_KEYS = [
  'assign_project',
  'approve_qc',
  'request_revision',
  'adjust_project_credits',
  'adjust_client_credits',
  'change_client_tier',
  'change_subscription_status',
  'warn_creative',
  'suspend_creative',
  'manage_notifications',
  'manage_briefing_templates',
  'manage_image_bank',
  'manage_users',
  'manage_admins',
]

export const ADMIN_PERMISSION_PRESETS = {
  project_admin: {
    modules: {
      overview: true,
      finance: false,
      operations: true,
      users: false,
      clients: true,
      creatives: true,
      projects: true,
      credit_transactions: false,
      payments_subscriptions: false,
      notifications: true,
      briefing_templates: false,
      image_moderation: false,
      reports: true,
      admins: false,
    },
    actions: {
      assign_project: true,
      approve_qc: true,
      request_revision: true,
      adjust_project_credits: true,
      adjust_client_credits: false,
      change_client_tier: false,
      change_subscription_status: false,
      warn_creative: true,
      suspend_creative: false,
      manage_notifications: true,
      manage_briefing_templates: false,
      manage_image_bank: false,
      manage_users: false,
      manage_admins: false,
    },
  },
  app_admin: {
    modules: {
      overview: true,
      finance: true,
      operations: true,
      users: true,
      clients: true,
      creatives: true,
      projects: false,
      credit_transactions: true,
      payments_subscriptions: true,
      notifications: true,
      briefing_templates: true,
      image_moderation: true,
      reports: true,
      admins: false,
    },
    actions: {
      assign_project: true,
      approve_qc: true,
      request_revision: true,
      adjust_project_credits: false,
      adjust_client_credits: true,
      change_client_tier: true,
      change_subscription_status: true,
      warn_creative: true,
      suspend_creative: true,
      manage_notifications: true,
      manage_briefing_templates: true,
      manage_image_bank: true,
      manage_users: true,
      manage_admins: false,
    },
  },
}
