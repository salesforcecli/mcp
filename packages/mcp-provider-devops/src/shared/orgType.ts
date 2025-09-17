import { getConnection } from "./auth.js";
import type { Connection } from "@salesforce/core";

/**
 * Determines if an org uses the Managed Package DevOps model by checking for MP objects.
 */
export async function isManagedPackageDevopsOrg(username: string, connectionOverride?: Connection): Promise<boolean> {
  const connection = connectionOverride ?? await getConnection(username);
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


