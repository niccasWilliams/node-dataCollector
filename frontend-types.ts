// AUTO-GENERATED FILE - DO NOT EDIT MANUALLY
// Generated at: 2025-11-07T17:19:11.826Z
// Run `npm run types:generate` to regenerate this file

// ============================================================================
// ENUMS & LITERAL TYPES
// ============================================================================

export type AppSettingsType = 'string' | 'number' | 'boolean' | 'json';
export type WebhookStatus = 'pending' | 'processed' | 'failed' | 'skipped';
export type AppLogLevel = 'info' | 'warn' | 'error' | 'debug' | 'fatal' | 'critical';
export type RoleAssignmentStatus = 'active' | 'expired' | 'revoked';

export type ProductAvailability = "in_stock" | "out_of_stock" | "limited_stock" | "preorder" | "discontinued" | "unknown"
export type PriceAlertType = "below_price" | "percentage_drop" | "back_in_stock" | "price_error"
export type PriceAlertStatus = "active" | "expired" | "disabled" | "triggered"
export type ProductAttributeType = "custom" | "screen_size" | "storage" | "memory" | "color" | "resolution" | "processor" | "weight" | "dimensions" | "connectivity"
export type ProductMatchStatus = "pending" | "accepted" | "rejected" | "auto_merged"
export type ScrapingQualitySeverity = "info" | "critical" | "warning"
export type ScrapingQualityStatus = "open" | "acknowledged" | "resolved" | "ignored"
export type WebsiteWorkflowType = "custom" | "price_check" | "data_extraction" | "form_fill" | "monitoring" | "scraping" | "testing"
export type WebsiteWorkflowStatus = "error" | "active" | "disabled" | "paused"
export type WebsiteWorkflowRunStatus = "pending" | "running" | "success" | "failed" | "timeout" | "cancelled"
export type BrowserSessionStatus = "active" | "idle" | "navigating" | "closed"
export type BrowserActivityType = "navigation" | "screenshot" | "interaction" | "script" | "extraction"


// ============================================================================
// DATABASE TYPES - Base Schema
// ============================================================================

export type User = {
  id: number;
  externalUserId: string | null;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  createdAt: Date;
  updatedAt: Date | null;
};

export type UserId = number;

export type UserActivity = {
  id: number;
  userId: number;
  activityDate: string;
  firstActivityAt: Date;
  lastActivityAt: Date;
  requestCount: number;
  requests: any;
  createdAt: Date;
  updatedAt: Date;
};

export type UserActivityId = number;

export type AppSettings = {
  id: number;
  key: string;
  value: string;
  type: AppSettingsType;
  description: string | null;
  createdAt: Date;
};

export type AppSettingsId = number;

export type AppLog = {
  id: number;
  level: AppLogLevel;
  message: string;
  context: any;
  createdAt: Date;
};

export type AppLogId = number;

export type Webhook = {
  id: number;
  provider: string;
  eventType: string;
  externalId: string;
  payload: any;
  processed: boolean;
  status: WebhookStatus;
  processMessage: string | null;
  originUrl: string | null;
  createdAt: Date;
  processedAt: Date | null;
  userAgent: string | null;
  signature: string | null;
  retryCount: number;
  lastRetryAt: Date | null;
};

export type WebhookId = number;

export type Permission = {
  id: number;
  name: string;
  description: string | null;
};

export type PermissionId = number;

export type Role = {
  id: number;
  name: string;
  description: string | null;
  createdAt: Date;
};

export type RoleId = number;

export type RolePermission = {
  id: number;
  roleId: number;
  permissionId: number;
  assignedBy: number;
  revokedBy: number | null;
  createdAt: Date;
  validTo: Date | null;
};

export type RolePermissionId = number;

export type RoleAssignment = {
  id: number;
  userId: number;
  status: RoleAssignmentStatus;
  roleId: number;
  validFrom: Date;
  validTo: Date | null;
  assignedBy: number;
  revokedBy: number | null;
  createdAt: Date;
};

export type RoleAssignmentId = number;


// ============================================================================
// DATABASE TYPES - Individual Schema
// ============================================================================

export type MergedProduct = {
  id: number;
  ean: string | null;
  asin: string | null;
  name: string;
  brand: string | null;
  model: string | null;
  category: string | null;
  description: string | null;
  imageUrl: string | null;
  images: any;
  metadata: any;
  dataQualityScore: string;
  sourceCount: number;
  createdAt: Date;
  updatedAt: Date;
};

export type MergedProductId = number;

export type Product = {
  id: number;
  mergedProductId: number | null;
  ean: string | null;
  asin: string | null;
  name: string;
  brand: string | null;
  model: string | null;
  category: string | null;
  description: string | null;
  imageUrl: string | null;
  metadata: any;
  createdAt: Date;
  updatedAt: Date;
};

export type ProductId = number;

export type ProductVariant = {
  id: number;
  mergedProductId: number | null;
  primaryProductId: number | null;
  fingerprint: string;
  label: string | null;
  attributes: any;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type ProductVariantId = number;

export type ProductSource = {
  id: number;
  productId: number;
  websitePageId: number;
  shopProductId: string | null;
  shopSku: string | null;
  priceSelector: string | null;
  availabilitySelector: string | null;
  titleSelector: string | null;
  imageSelector: string | null;
  isActive: boolean;
  lastScrapedAt: Date | null;
  lastSeenAt: Date | null;
  metadata: any;
  createdAt: Date;
  updatedAt: Date;
};

export type ProductSourceId = number;

export type PriceHistory = {
  id: number;
  variantId: number;
  productSourceId: number;
  price: string;
  currency: string;
  originalPrice: string | null;
  discountPercentage: string | null;
  availability: ProductAvailability;
  stockQuantity: number | null;
  priceChanged: boolean;
  priceDelta: string | null;
  percentageChange: string | null;
  metadata: any;
  recordedAt: Date;
  updatedAt: Date;
};

export type PriceHistoryId = number;

export type PriceAlert = {
  id: number;
  mergedProductId: number | null;
  variantId: number | null;
  userId: number | null;
  type: PriceAlertType;
  status: PriceAlertStatus;
  targetPrice: string | null;
  percentageThreshold: string | null;
  name: string;
  description: string | null;
  notifyEmail: boolean;
  notifyWebhook: boolean;
  webhookUrl: string | null;
  triggeredAt: Date | null;
  triggeredPrice: string | null;
  acknowledgedAt: Date | null;
  expiresAt: Date | null;
  metadata: any;
  createdAt: Date;
  updatedAt: Date;
};

export type PriceAlertId = number;

export type ProductAttribute = {
  id: number;
  variantId: number | null;
  type: ProductAttributeType;
  key: string;
  value: string;
  unit: string | null;
  displayValue: string;
  normalizedValue: string | null;
  normalizedUnit: string | null;
  source: string;
  confidence: string;
  metadata: any;
  createdAt: Date;
  updatedAt: Date;
};

export type ProductAttributeId = number;

export type ProductMatchSuggestion = {
  id: number;
  productId: number;
  mergedProductId: number;
  confidence: string;
  matchReasons: any;
  comparisonData: any;
  status: ProductMatchStatus;
  reviewedBy: number | null;
  reviewedAt: Date | null;
  reviewNotes: string | null;
  actionTaken: string | null;
  metadata: any;
  createdAt: Date;
  updatedAt: Date;
};

export type ScrapingQualityLog = {
  id: number;
  url: string;
  domain: string;
  adapter: string | null;
  productId: number | null;
  issueFingerprint: string;
  missingFields: any;
  fieldErrors: any;
  extractedFields: any;
  validationErrors: any;
  severity: ScrapingQualitySeverity;
  status: ScrapingQualityStatus;
  firstSeenAt: Date;
  lastSeenAt: Date;
  occurrenceCount: number;
  resolvedAt: Date | null;
  resolvedBy: number | null;
  resolution: string | null;
  resolutionNotes: string | null;
  screenshot: string | null;
  pageHtmlSample: string | null;
  metadata: any;
  createdAt: Date;
  updatedAt: Date;
};

export type ScrapingQualityLogId = number;

export type Website = {
  id: number;
  domain: string;
  name: string | null;
  description: string | null;
  metadata: any;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type WebsiteId = number;

export type WebsiteCredential = {
  id: number;
  websiteId: number;
  username: string | null;
  password: string | null;
  totpSecret: string | null;
  sessionData: any;
  sessionExpiresAt: Date | null;
  label: string | null;
  description: string | null;
  isActive: boolean;
  lastUsedAt: Date | null;
  lastValidatedAt: Date | null;
  failedLoginAttempts: number;
  lastFailedAt: Date | null;
  lastError: string | null;
  metadata: any;
  createdAt: Date;
  updatedAt: Date;
};

export type WebsiteCredentialId = number;

export type WebsitePage = {
  id: number;
  websiteId: number;
  url: string;
  path: string;
  title: string | null;
  description: string | null;
  contentHash: string | null;
  htmlSnapshot: string | null;
  metadata: any;
  lastScannedAt: Date | null;
  scanCount: number;
  createdAt: Date;
  updatedAt: Date;
};

export type WebsitePageId = number;

export type WebsiteElement = {
  id: number;
  pageId: number;
  tagName: string;
  cssSelector: string;
  attributes: any;
  classes: any;
  textContent: string | null;
  nameAttr: string | null;
  href: string | null;
  typeAttr: string | null;
  role: string | null;
  formAction: string | null;
  visible: boolean;
  disabled: boolean;
  boundingBox: any | null;
  orderIndex: number;
  createdAt: Date;
  updatedAt: Date;
};

export type WebsiteElementId = number;

export type WebsiteWorkflow = {
  id: number;
  websiteId: number;
  pageId: number | null;
  name: string;
  description: string | null;
  type: WebsiteWorkflowType;
  status: WebsiteWorkflowStatus;
  config: any;
  selectors: any;
  schedule: string | null;
  retryCount: number;
  timeout: number;
  runCount: number;
  successCount: number;
  failureCount: number;
  lastRunAt: Date | null;
  lastSuccessAt: Date | null;
  lastFailureAt: Date | null;
  metadata: any;
  createdAt: Date;
  updatedAt: Date;
};

export type WebsiteWorkflowId = number;

export type WebsiteWorkflowRun = {
  id: number;
  workflowId: number;
  browserSessionId: string | null;
  status: WebsiteWorkflowRunStatus;
  startedAt: Date | null;
  completedAt: Date | null;
  duration: number | null;
  result: any;
  error: string | null;
  logs: any;
  screenshotPaths: any;
  metadata: any;
  createdAt: Date;
};

export type WebsiteWorkflowRunId = number;

export type BrowserProfile = {
  id: number;
  name: string;
  website: string | null;
  fingerprintSeed: number;
  userDataPath: string;
  userId: number | null;
  description: string | null;
  createdAt: Date;
  lastUsedAt: Date;
  updatedAt: Date;
};

export type BrowserProfileId = number;

export type BrowserSession = {
  id: number;
  sessionId: string;
  userId: number | null;
  status: BrowserSessionStatus;
  currentUrl: string | null;
  title: string | null;
  config: any;
  metadata: any;
  createdAt: Date;
  lastActivityAt: Date;
  closedAt: Date | null;
};

export type BrowserSessionId = number;

export type BrowserActivity = {
  id: number;
  sessionId: string;
  type: BrowserActivityType;
  action: string;
  target: string | null;
  value: string | null;
  metadata: any;
  success: boolean;
  error: string | null;
  duration: number | null;
  timestamp: Date;
};

export type BrowserActivityId = number;

export type BrowserScreenshot = {
  id: number;
  sessionId: string;
  activityId: number | null;
  url: string;
  title: string | null;
  path: string;
  fullPage: boolean;
  width: number | null;
  height: number | null;
  size: number | null;
  metadata: any;
  createdAt: Date;
};

export type BrowserScreenshotId = number;

export type BrowserExtractedData = {
  id: number;
  sessionId: string;
  activityId: number | null;
  url: string;
  dataType: string;
  data: any;
  schema: any | null;
  metadata: any;
  createdAt: Date;
};

export type BrowserExtractedDataId = number;


// ============================================================================
// PERMISSIONS
// ============================================================================

export enum AppPermissions {
  UsersManage = "users_manage",
  UsersView = "users_view",
  SettingsEdit = "settings_edit",
  PermissionsManage = "permissions_manage",
  PermissionsHistoryView = "permissions_history_view",
  RolesManage = "roles_manage",
  RolesHistoryView = "roles_history_view",
  WebhookView = "webhook_view",
  WebhookDelete = "webhook_delete",
  LogView = "log_view",
  LogDelete = "log_delete",
  ArticlesCreate = "articles_create",
  ArticlesEdit = "articles_edit",
  ArticlesDelete = "articles_delete",
  ArticlesView = "articles_view"
}

export type AppPermissionValue = (typeof AppPermissions)[keyof typeof AppPermissions];

// ============================================================================
// SETTINGS
// ============================================================================

export enum AppSettingsKey {
  ApplicationName = "application_name",
  ApiKey = "api_key",
  MaxUploadSize = "max_upload_size"
}

export type AppSettingsTypeMap = {
    [AppSettingsKey.ApplicationName]: string;
    // Add more type mappings here:
    // [AppSettingsKey.ApiKey]: string;
    // [AppSettingsKey.MaxUploadSize]: number;
};

// ============================================================================
// UTILITY TYPES
// ============================================================================

export type Languages = "DE" | "EN";

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

export type ApiResponse<T> = {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
};

export type PaginatedResponse<T> = {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};
