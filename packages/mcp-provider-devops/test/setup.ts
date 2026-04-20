// Disable Salesforce CLI file logging during tests to avoid writes to ~/.sf
// in sandboxed/readonly environments.
process.env.SFDX_DISABLE_LOG_FILE = "true";
process.env.SF_DISABLE_LOG_FILE = "true";
