export type MessageCatalog = { [key: string]: string };

const MESSAGE_CATALOG: MessageCatalog = {
    targetArrayCannotBeEmpty: "Target array must be non-empty.",
    allTargetsMustExist: `All targeted files must exist, but %s does not exist.`,
    targetsCannotBeDirectories: `All targets must be files, but %s is a directory.`,
    tooManyTargets: `The number of targets, %d, exceeds the maximum allowable length of %d.`,
    ruleNotFound: `No rule with name '%s' exists in engine '%s'.`,
    errorCreatingConfig: `Error creating Code Analyzer Config: %s`,
    errorAddingEngine: `Error adding engine: %s`,
    errorLogWrapper: `Error within %s: %s`,
    runCompletedWithErrorsHeader: `Run completed successfully, but the following errors were logged, and results may be incomplete:`
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