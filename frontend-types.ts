// AUTO-GENERATED FILE - DO NOT EDIT MANUALLY
// Generated at: 2025-10-25T18:43:01.786Z
// Run `npm run types:generate` to regenerate this file

// ============================================================================
// ENUMS & LITERAL TYPES
// ============================================================================

export type AppSettingsType = 'string' | 'number' | 'boolean' | 'json';
export type WebhookStatus = 'pending' | 'processed' | 'failed' | 'skipped';
export type AppLogLevel = 'info' | 'warn' | 'error' | 'debug' | 'fatal' | 'critical';
export type RoleAssignmentStatus = 'active' | 'expired' | 'revoked';

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

export type DummyTable = {
  id: string;
  name: string;
  NEUERWERT: string;
  isActive: boolean;
  data: any;
  createdAt: Date;
  updatedAt: Date;
};

export type DummyTableId = number;


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
