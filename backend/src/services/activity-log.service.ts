export interface ActivityLogInput {
  organization_id: number;
  entity_type: string;
  entity_id: string | number;
  entity_label: string;
  action: string;
  field_changed?: string | null;
  old_value?: string | null;
  new_value?: string | null;
  user_id: number;
  user_name: string;
  metadata?: Record<string, unknown> | null;
}

export interface ActivityLogFilters {
  page?: number | string;
  pageSize?: number | string;
  userId?: number | string;
  entityType?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
}

const activityLogger = require('./activity-log.service.js');

export const log = activityLogger.log as (
  data: ActivityLogInput
) => Promise<unknown>;

export const getEntityHistory = activityLogger.getEntityHistory as (
  entityType: string,
  entityId: string | number,
  organizationId: number,
  filters?: Pick<ActivityLogFilters, 'page' | 'pageSize'>
) => Promise<unknown>;

export const getOrganizationFeed = activityLogger.getOrganizationFeed as (
  organizationId: number,
  filters?: ActivityLogFilters
) => Promise<unknown>;

export const exportOrganizationFeedCsv = activityLogger.exportOrganizationFeedCsv as (
  organizationId: number,
  filters?: Omit<ActivityLogFilters, 'page' | 'pageSize'>
) => Promise<string>;
