export interface AutomationExecutionLogInput {
  automation_id: string;
  organization_id: number;
  trigger_type: string;
  trigger_data?: Record<string, unknown>;
  action_type: string;
  action_data?: Record<string, unknown>;
  success: boolean;
  error_message?: string | null;
  contact_id?: number | null;
  duration_ms?: number | null;
}

export interface AutomationLogFilters {
  page?: number | string;
  pageSize?: number | string;
  status?: 'all' | 'success' | 'failed';
  dateFrom?: string;
  dateTo?: string;
}

const automationLogger = require('./automation-logger.service.js');

export const logExecution = automationLogger.logExecution as (
  data: AutomationExecutionLogInput
) => Promise<unknown>;

export const getAutomationLogs = automationLogger.getAutomationLogs as (
  automationId: string,
  organizationId: number,
  filters?: AutomationLogFilters
) => Promise<unknown>;

export const getAutomationStats = automationLogger.getAutomationStats as (
  organizationId: number,
  dateRange?: { dateFrom?: string; dateTo?: string }
) => Promise<unknown>;

export const getAutomationExecutionSummary = automationLogger.getAutomationExecutionSummary as (
  organizationId: number,
  options?: { automationIds?: string[]; successWindowDays?: number }
) => Promise<unknown>;
