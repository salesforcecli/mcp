import { getConnection } from "./auth.js";
import { Connection } from "@salesforce/core";

/**
 * Check whether the given org uses the Managed Package DevOps model.
 *
 * Heuristic: attempts a lightweight SOQL on a known MP object
 * (sf_devops__Project__c). If the object exists, we treat the org as
 * Managed Package DevOps. If the object type is invalid, we assume it's not MP.
 *
 * This can be extended later (e.g., check installed packages or additional
 * objects) without changing the call sites.
 */
export async function isManagedPackageDevopsOrg(username?: string, alias?: string): Promise<boolean> {
  let connection: Connection;
  try {
    const usernameOrAlias = username ?? alias;
    if (!usernameOrAlias) {
      throw new Error("Username or alias of valid DevOps Center org is required");
    }
    connection = await getConnection(usernameOrAlias);
  } catch (error: any) {
    throw error;
  }
  try {
    await connection.query("SELECT Id FROM sf_devops__Project__c LIMIT 1");
    return true;
  } catch (error: any) {
    const message = String(error?.message || "");
    const isInvalidType = message.includes("INVALID_TYPE") || message.includes("sObject type 'sf_devops__Project__c' is not supported");
    if (isInvalidType) {
      return false;
    }
    throw error;
  }
}
