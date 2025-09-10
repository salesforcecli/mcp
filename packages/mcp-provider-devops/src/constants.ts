export const TelemetryEventName = "devops"
export const TelemetrySource = "MCP"

export const McpTelemetryEvents = {
    WORKITEM_OPERATION: 'workitem_operation',
    PROJECT_OPERATION: 'project_operation',
    PIPELINE_OPERATION: 'pipeline_operation',
    DEPLOYMENT_OPERATION: 'deployment_operation',
    CONFLICT_OPERATION: 'conflict_operation'
}

export const DevOpsOperations = {
    LIST_ORGS: 'list_orgs',
    LIST_PROJECTS: 'list_projects',
    LIST_WORKITEMS: 'list_workitems',
    CHECKOUT_WORKITEM: 'checkout_workitem',
    COMMIT_WORKITEM: 'commit_workitem',
    DEPLOY_PROJECT: 'deploy_project',
    GET_CHANGES: 'get_changes',
    PROMOTE_WORKITEM: 'promote_workitem',
    CREATE_PULLREQUEST: 'create_pullrequest'
}
