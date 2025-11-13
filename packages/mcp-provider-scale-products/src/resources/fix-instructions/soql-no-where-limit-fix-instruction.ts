/**
 * Fix instructions for SOQL queries without WHERE or LIMIT clauses
 */
export function getSOQLNoWhereLimitFixInstructions(): string {
  return `
# SOQL Without WHERE or LIMIT Clause Antipattern - Fix Instructions

## Overview
SOQL queries without WHERE clauses or LIMIT statements can retrieve excessive records, leading to governor limit exceptions, performance degradation, and inefficient resource utilization. This antipattern is especially critical when queries are inside loops or process large data volumes.

## Common Issues
- Governor limit exceptions (max 50,000 rows per transaction)
- Heap size limit exceptions when processing large result sets
- Poor performance and slow page loads
- Increased CPU time and database query time
- Inefficient resource utilization across the org

---

## Antipattern 1: SOQL in Loop Without WHERE or LIMIT
**Severity: CRITICAL**

### Problem
Running SOQL queries inside loops without proper filtering or limits is the most dangerous antipattern. Each iteration can retrieve thousands of records, quickly exhausting governor limits and causing transaction failures.

### Example of Antipattern
\`\`\`apex
public class AccountProcessor {
    public void processAccounts(List<String> accountTypes) {
        for (String accType : accountTypes) {
            // ❌ CRITICAL: SOQL in loop with no WHERE/LIMIT
            // If each type has 10,000 records, this could retrieve 50,000+ records
            List<Account> accounts = [
                SELECT Id, Name, Type 
                FROM Account 
                WHERE Type = :accType
            ];
            
            for (Account acc : accounts) {
                // Process each account
                System.debug('Processing: ' + acc.Name);
            }
        }
    }
}
\`\`\`

### Recommended Fix
Add a LIMIT clause to prevent excessive record retrieval in loops:

\`\`\`apex
public class AccountProcessor {
    // ✅ GOOD: SOQL in loop with strict LIMIT
    public void processAccounts(List<String> accountTypes) {
        for (String accType : accountTypes) {
            // Limit to prevent governor limit violations
            List<Account> accounts = [
                SELECT Id, Name, Type 
                FROM Account 
                WHERE Type = :accType
                LIMIT 100  // Prevent excessive records per iteration
            ];
            
            for (Account acc : accounts) {
                System.debug('Processing: ' + acc.Name);
            }
        }
    }
    
    // ✅ BETTER: Refactor to avoid SOQL in loop entirely
    public void processAccountsOptimized(List<String> accountTypes) {
        // Single query outside loop
        List<Account> accounts = [
            SELECT Id, Name, Type 
            FROM Account 
            WHERE Type IN :accountTypes
            LIMIT 1000
        ];
        
        for (Account acc : accounts) {
            System.debug('Processing: ' + acc.Name);
        }
    }
}
\`\`\`

---

## Antipattern 2: No WHERE and No LIMIT (Standard Objects)
**Severity: HIGH**

### Problem
Queries on standard objects without any filtering or limits can retrieve tens of thousands of records, hitting the 50,000 row governor limit and causing heap size exceptions.

### Example of Antipattern
\`\`\`apex
public class ContactExporter {
    public void exportAllContacts() {
        // ❌ HIGH: No WHERE, no LIMIT on standard object
        // Could retrieve all 100,000+ contacts in the org
        List<Contact> contacts = [
            SELECT Id, FirstName, LastName, Email 
            FROM Contact
        ];
        
        // Process contacts (likely to fail with large datasets)
        for (Contact c : contacts) {
            System.debug(c.Email);
        }
    }
}
\`\`\`

### Recommended Fix
Add both WHERE clause for filtering and LIMIT for safety:

\`\`\`apex
public class ContactExporter {
    // ✅ GOOD: Both WHERE and LIMIT for standard objects
    public void exportActiveContacts() {
        List<Contact> contacts = [
            SELECT Id, FirstName, LastName, Email 
            FROM Contact 
            WHERE Email != null 
              AND IsDeleted = false
            LIMIT 10000
        ];
        
        for (Contact c : contacts) {
            System.debug(c.Email);
        }
    }
    
    // ✅ BETTER: Use batch processing for large datasets
    public class ContactExportBatch implements Database.Batchable<SObject> {
        public Database.QueryLocator start(Database.BatchableContext bc) {
            // QueryLocator can handle up to 50 million records
            return Database.getQueryLocator([
                SELECT Id, FirstName, LastName, Email 
                FROM Contact 
                WHERE Email != null
            ]);
        }
        
        public void execute(Database.BatchableContext bc, List<Contact> scope) {
            // Process in chunks of 200 (default batch size)
            for (Contact c : scope) {
                System.debug(c.Email);
            }
        }
        
        public void finish(Database.BatchableContext bc) {
            System.debug('Export complete');
        }
    }
}
\`\`\`

---

## Antipattern 3: Nested Queries Without Main Query Filter
**Severity: HIGH**

### Problem
Nested queries (subqueries) without filtering on the main query can retrieve all parent records, even if the subquery is filtered. The outer query drives the volume.

### Example of Antipattern
\`\`\`apex
public void getAccountsWithContacts() {
    // ❌ HIGH: Nested query without main WHERE/LIMIT
    // Retrieves ALL accounts (even those with no contacts)
    List<Account> accounts = [
        SELECT Id, Name,
            (SELECT Id, FirstName, LastName 
             FROM Contacts 
             WHERE Email != null)
        FROM Account
    ];
    
    System.debug('Accounts with contacts: ' + accounts.size());
}
\`\`\`

### Recommended Fix
Add WHERE and LIMIT to the outer query:

\`\`\`apex
public void getAccountsWithContacts() {
    // ✅ GOOD: Filter and limit the main query
    List<Account> accounts = [
        SELECT Id, Name,
            (SELECT Id, FirstName, LastName 
             FROM Contacts 
             WHERE Email != null)
        FROM Account
        WHERE Industry = 'Technology'
          AND AnnualRevenue > 1000000
        LIMIT 500
    ];
    
    System.debug('Accounts with contacts: ' + accounts.size());
}
\`\`\`

---

## Antipattern 4: Metadata Queries Without Specific Filter
**Severity: MEDIUM**

### Problem
Custom metadata and custom settings queries without filtering can retrieve all records, though typically these contain fewer records than standard objects. Still, it's a best practice to filter by DeveloperName.

### Example of Antipattern
\`\`\`apex
public class ConfigurationManager {
    public Integer getCacheTTL() {
        // ❌ MEDIUM: Metadata query without filter
        // Retrieves all CacheTTL__mdt records when you only need one
        List<CacheTTL__mdt> ttlRecords = [
            SELECT StoreCacheTTL__c 
            FROM CacheTTL__mdt
        ];
        
        return ttlRecords.isEmpty() ? 300 : Integer.valueOf(ttlRecords[0].StoreCacheTTL__c);
    }
}
\`\`\`

### Recommended Fix
Filter by DeveloperName and add LIMIT 1:

\`\`\`apex
public class ConfigurationManager {
    // ✅ GOOD: Metadata query with specific filter and LIMIT
    public Integer getCacheTTL() {
        List<CacheTTL__mdt> ttlRecords = [
            SELECT StoreCacheTTL__c 
            FROM CacheTTL__mdt 
            WHERE DeveloperName = 'Store_Cache_Settings'
            LIMIT 1
        ];
        
        return ttlRecords.isEmpty() ? 300 : Integer.valueOf(ttlRecords[0].StoreCacheTTL__c);
    }
    
    // ✅ BETTER: Use single-record query pattern
    public Integer getCacheTTLOptimized() {
        CacheTTL__mdt ttlRecord = CacheTTL__mdt.getInstance('Store_Cache_Settings');
        return ttlRecord != null ? Integer.valueOf(ttlRecord.StoreCacheTTL__c) : 300;
    }
}
\`\`\`

---

## Antipattern 5: Query Where Only First Record is Used
**Severity: MEDIUM**

### Problem
Retrieving all records when only the first one is used wastes resources and can still hit governor limits.

### Example of Antipattern
\`\`\`apex
public void getLatestOpportunity() {
    // ❌ MEDIUM: No LIMIT when only first record is used
    List<Opportunity> opps = [
        SELECT Id, Name, Amount 
        FROM Opportunity 
        WHERE StageName = 'Closed Won'
        ORDER BY CloseDate DESC
    ];
    
    if (!opps.isEmpty()) {
        Opportunity latestOpp = opps[0];  // Only using first record!
        System.debug('Latest: ' + latestOpp.Name);
    }
}
\`\`\`

### Recommended Fix
Add LIMIT 1 when only one record is needed:

\`\`\`apex
public void getLatestOpportunity() {
    // ✅ GOOD: LIMIT 1 when only first record is used
    List<Opportunity> opps = [
        SELECT Id, Name, Amount 
        FROM Opportunity 
        WHERE StageName = 'Closed Won'
        ORDER BY CloseDate DESC
        LIMIT 1
    ];
    
    if (!opps.isEmpty()) {
        Opportunity latestOpp = opps[0];
        System.debug('Latest: ' + latestOpp.Name);
    }
}
\`\`\`

---

## Best Practices Summary

1. **Never use unbounded SOQL in loops** - Always add LIMIT or refactor to query outside the loop
2. **Always add WHERE clause for standard objects** - Filter by relevant criteria (date ranges, status, etc.)
3. **Always add LIMIT clause** - Even with WHERE, add LIMIT as a safety net
4. **Use indexed fields in WHERE clauses** - Id, Name, External Id fields for better performance
5. **Use LIMIT 1 for single-record queries** - When only first record is needed
6. **For large datasets, use batch processing** - Database.Batchable or Database.QueryLocator
7. **Filter metadata queries by DeveloperName** - Use specific record instead of all records
8. **Consider data volume in your org** - Set realistic LIMIT values based on expected data

## How to Apply These Fixes

For each detected instance:
1. **Examine the \`severity\` field**:
   - **CRITICAL**: In a loop - apply Antipattern 1 fix, add strict LIMIT or refactor
   - **HIGH**: No WHERE and no LIMIT - apply Antipattern 2 fix, add both clauses
   - **MEDIUM**: Metadata or single-record pattern - apply Antipattern 4 or 5 fix

2. **Review the \`codeBefore\` field** to understand query context

3. **Determine the query type**:
   - Standard/custom objects → Need both WHERE and LIMIT
   - Metadata types → Filter by DeveloperName + LIMIT 1
   - In a loop → CRITICAL priority, add LIMIT or refactor
   - Only first record used → Add LIMIT 1

4. **Choose appropriate LIMIT values**:
   - LIMIT 1: Single record needed
   - LIMIT 100-200: Small batch processing
   - LIMIT 1000-10000: Large queries (still under governor limits)
   - No LIMIT: Only in Database.QueryLocator (batch context)

5. **Generate fixed code** with:
   - WHERE clause using relevant filtering criteria
   - LIMIT clause with appropriate value
   - Explanatory comments about the fix
   - Consider refactoring if in a loop

## Reference
- [SOQL and SOSL Guidelines](https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/langCon_apex_SOQL.htm)
- [Apex Governor Limits](https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/apex_gov_limits.htm)
- [Best Practices for SOQL](https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/apex_gov_limits_soql.htm)

Be concise but clear in your fixes.
  `.trim();
}
