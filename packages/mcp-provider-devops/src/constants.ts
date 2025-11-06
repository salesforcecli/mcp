/**
 * Constants for DevOps provider telemetry
 */

export const TelemetryEventNames = {
  LIST_PROJECTS: 'devops_list_projects',
  LIST_WORK_ITEMS: 'devops_list_work_items',
  PROMOTE_WORK_ITEM: 'devops_promote_work_item',
  CHECKOUT_WORK_ITEM: 'devops_checkout_work_item',
  COMMIT_WORK_ITEM: 'devops_commit_work_item',
  CHECK_COMMIT_STATUS: 'devops_check_commit_status',
  CREATE_PULL_REQUEST: 'devops_create_pull_request',
  DETECT_CONFLICT: 'devops_detect_conflict',
  RESOLVE_CONFLICT: 'devops_resolve_conflict',
} as const;

export const TelemetrySource = 'MCP-DevOps';

