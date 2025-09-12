export type MessageCatalog = { [key: string]: string };

const MESSAGE_CATALOG: MessageCatalog = {
    noOrgsFound: "No Salesforce orgs found. Please ensure you are logged into at least one org.",
    orgAuthRequired: "Organization authentication is required. Please log in to the specified org.",
    invalidWorkItemId: "Invalid work item ID '%s'. Please provide a valid work item ID.",
    workItemNotFound: "Work item '%s' not found in the specified project.",
    projectNotFound: "Project '%s' not found. Please verify the project ID.",
    pipelineNotFound: "Pipeline '%s' not found. Please verify the pipeline ID.",
    branchCheckoutFailed: "Failed to checkout branch '%s': %s",
    deploymentFailed: "Deployment to org '%s' failed: %s",
    commitFailed: "Failed to commit changes for work item '%s': %s",
    promotionFailed: "Failed to promote work item '%s': %s",
    conflictDetected: "Merge conflicts detected in files: %s",
    pullRequestCreated: "Pull request created successfully: %s",
    noChangesDetected: "No changes detected in the specified org.",
    invalidOrgType: "Invalid org type. Expected DevOps Center or Sandbox org.",
    repositoryCloneFailed: "Failed to clone repository '%s': %s",
    invalidBranchName: "Invalid branch name '%s'. Please provide a valid branch name.",
    errorWrapper: "Error in %s: %s"
}

export function getMessage(msgId: string, ...args: (string | number)[]): string {
    const messageTemplate = MESSAGE_CATALOG[msgId];
    if (messageTemplate === undefined) {
        throw new Error(`Message with id "${msgId}" does not exist in the message catalog.`);
    }
    const argsLength = args.length; // Capturing length here because once we shift, it'll change.
    let replaceCount = 0;
    const message: string = messageTemplate.replace(/%[sd]/g, (match) => {
        replaceCount++;
        return String(args.shift() ?? match)
    });
    if (replaceCount != argsLength) {
        throw new Error(`Incorrect number of variables supplied to the message '${msgId}' in the message catalog.\n`
            + `Expected amount: ${replaceCount}. Actual amount: ${argsLength}.`);
    }
    return message;
}
