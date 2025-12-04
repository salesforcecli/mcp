/**
 * Fix instruction for SOQL Unused Fields antipattern
 * Provides comprehensive guidance on optimizing SOQL queries
 */

export const SOQL_UNUSED_FIELDS_FIX_INSTRUCTION = `# SOQL Unused Fields Antipattern - Fix Instructions

## Overview
Selecting unnecessary fields in SOQL queries wastes database resources, increases query execution time, and consumes heap memory with unused data. This antipattern is particularly impactful in high-volume environments or when dealing with large records.

## Problem
When SOQL queries select fields that are never used in subsequent code, it causes:
- **Wasted Database Resources**: Database spends time retrieving unnecessary data
- **Increased Query Time**: More fields = longer query execution
- **Heap Memory Waste**: Unused data occupies valuable heap space
- **Network Overhead**: More data transferred between database and application
- **Reduced Performance**: Overall system slowdown, especially at scale

---

## Solution: Remove Unused Fields

The fix is straightforward: **remove fields from the SELECT clause that are never accessed in your code**.

### Example 1: Basic Unused Fields (MEDIUM Severity)

**❌ BEFORE (Antipattern):**
\`\`\`apex
Account acc = [SELECT Id, Name, Phone, Industry, AnnualRevenue 
               FROM Account 
               WHERE Id = :accountId 
               LIMIT 1];
System.debug('Account: ' + acc.Name);
// Only Name is used - Phone, Industry, AnnualRevenue are unused!
\`\`\`

**✅ AFTER (Optimized):**
\`\`\`apex
Account acc = [SELECT Id, Name 
               FROM Account 
               WHERE Id = :accountId 
               LIMIT 1];
System.debug('Account: ' + acc.Name);
// Only select what you need
\`\`\`

**Impact:**
- 60% reduction in selected data
- Faster query execution
- Less heap memory usage

---

### Example 2: Fields Used in Later SOQLs

**❌ BEFORE (Antipattern):**
\`\`\`apex
Account acc = [SELECT Id, Name, ParentId, Phone, Industry 
               FROM Account 
               LIMIT 1];
// Later in code...
List<Account> children = [SELECT Id FROM Account WHERE ParentId = :acc.Id];
// Only Id and ParentId are actually used - Name, Phone, Industry are unused!
\`\`\`

**✅ AFTER (Optimized):**
\`\`\`apex
Account acc = [SELECT Id, ParentId 
               FROM Account 
               LIMIT 1];
List<Account> children = [SELECT Id FROM Account WHERE ParentId = :acc.Id];
// Keep only fields that are used
\`\`\`

---

### Example 3: Loop Context (HIGH Severity)

**❌ BEFORE (Antipattern):**
\`\`\`apex
for (Contact con : [SELECT Id, FirstName, LastName, Email, Phone, Title 
                    FROM Contact 
                    WHERE AccountId = :accId]) {
    System.debug(con.FirstName + ' ' + con.LastName);
    // Only FirstName and LastName are used in loop!
}
\`\`\`

**✅ AFTER (Optimized):**
\`\`\`apex
for (Contact con : [SELECT Id, FirstName, LastName 
                    FROM Contact 
                    WHERE AccountId = :accId]) {
    System.debug(con.FirstName + ' ' + con.LastName);
}
// 50% reduction in data retrieved
\`\`\`

---

## When NOT to Remove Fields

### ⚠️ Exclusion 1: Returned SOQL Results
If you return the SOQL result, keep all fields:

\`\`\`apex
public List<Account> getAccounts() {
    // Don't optimize - results are returned
    return [SELECT Id, Name, Phone, Industry FROM Account WHERE Type = 'Customer'];
}
\`\`\`

### ⚠️ Exclusion 2: Class Member Assignment
If SOQL is assigned to a class member, skip optimization:

\`\`\`apex
public class MyClass {
    private Account myAccount;
    
    public void loadAccount() {
        // Don't optimize - assigned to class member
        this.myAccount = [SELECT Id, Name, Phone FROM Account LIMIT 1];
    }
}
\`\`\`

### ⚠️ Exclusion 3: Nested Queries
If SOQL contains subqueries, optimization is more complex:

\`\`\`apex
// Don't auto-optimize nested queries - too complex
List<Account> accs = [
    SELECT Id, Name, 
        (SELECT Id, Name FROM Contacts)
    FROM Account
];
\`\`\`

### ⚠️ Exclusion 4: Complete Object Usage
If the entire object is used, keep all fields:

\`\`\`apex
Account acc = [SELECT Id, Name, Phone FROM Account LIMIT 1];
// Complete object passed around
processAccount(acc);
insert new Opportunity(AccountId = acc.Id, Account = acc);
\`\`\`

---

## System Fields

The following fields are **automatically excluded** from optimization:
- \`Id\` - Required by Salesforce, often needed implicitly
- \`COUNT()\` - Aggregate functions have different usage patterns

---

## Best Practices

### 1. Select Only What You Need
**Always think about which fields you'll actually use before writing the query.**

### 2. Review Existing Queries
Periodically audit your SOQL queries to remove fields that are no longer needed after code refactoring.

### 3. Consider Future Usage
If a field might be needed soon, weigh the cost of optimization vs. having to add it back later.

### 4. Measure Impact
For high-volume queries, measure the performance improvement after optimization.

### 5. Document Decisions
If you deliberately keep extra fields, add a comment explaining why:

\`\`\`apex
// Including Phone for future feature - DO NOT REMOVE
Account acc = [SELECT Id, Name, Phone FROM Account WHERE Id = :accId];
\`\`\`

---

## Performance Impact

### Small Records (< 10 fields)
- **Savings**: 5-15% query time reduction per unused field
- **Impact**: Moderate - noticeable in bulk operations

### Large Records (> 20 fields)
- **Savings**: 10-30% query time reduction
- **Impact**: Significant - especially with text/rich-text fields

### High-Volume Scenarios
- **Savings**: Up to 50% heap usage reduction
- **Impact**: Critical - can prevent governor limit exceptions

---

## How to Apply This Fix

For each detected instance:

1. **Review the \`unusedFields\` list** - These are the fields to remove

2. **Check the \`codeAfter\` field** - This contains the optimized SOQL query

3. **Verify the fix** - Ensure removed fields are truly unused:
   - Check variable access patterns (\`var.FieldName\`)
   - Check later SOQL queries that reference the variable
   - Check if variable is returned or passed to methods

4. **Apply the optimization** - Replace the original SOQL with the optimized version

5. **Test thoroughly** - Ensure functionality remains unchanged

---

## Common Mistakes to Avoid

### ❌ Mistake 1: Removing Required Fields
Don't remove fields that are used indirectly:

\`\`\`apex
// BAD: RecordTypeId is used in WHERE clause of later query
Account acc = [SELECT Id FROM Account LIMIT 1];
List<Opportunity> opps = [SELECT Id FROM Opportunity 
                          WHERE RecordTypeId = :acc.RecordTypeId]; // Error!
\`\`\`

### ❌ Mistake 2: Over-Optimization
Don't optimize queries in dynamic contexts where field usage is unclear:

\`\`\`apex
// CAUTION: Fields might be used dynamically
Account acc = [SELECT Id, Name FROM Account LIMIT 1];
String fieldName = UserSettings.getDisplayField(); // Unknown at compile time
System.debug(acc.get(fieldName)); // Might need more fields
\`\`\`

### ❌ Mistake 3: Ignoring Future Needs
Consider upcoming features before removing fields:

\`\`\`apex
// Consider keeping Phone if email feature is coming soon
Contact con = [SELECT Id, Email FROM Contact]; // Removed Phone
\`\`\`

---

## Real-World Example

**Before Optimization:**
\`\`\`apex
public void processAccounts(List<Id> accountIds) {
    List<Account> accounts = [
        SELECT Id, Name, Phone, Fax, Website, Industry, 
               AnnualRevenue, NumberOfEmployees, Description,
               BillingStreet, BillingCity, BillingState
        FROM Account
        WHERE Id IN :accountIds
    ];
    
    for (Account acc : accounts) {
        // Only Name and Industry actually used
        logger.log('Processing: ' + acc.Name + ' (' + acc.Industry + ')');
    }
}
\`\`\`

**After Optimization:**
\`\`\`apex
public void processAccounts(List<Id> accountIds) {
    List<Account> accounts = [
        SELECT Id, Name, Industry
        FROM Account
        WHERE Id IN :accountIds
    ];
    
    for (Account acc : accounts) {
        logger.log('Processing: ' + acc.Name + ' (' + acc.Industry + ')');
    }
}
// 75% reduction in data retrieved!
// 3x faster query execution
// 50% less heap usage
\`\`\`

---

## Reference
- [SOQL Best Practices](https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/langCon_apex_SOQL_SOSL.htm)
- [Apex Governor Limits](https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/apex_gov_limits.htm)
- [Query Performance](https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/apex_dev_guide_soql_query_perf.htm)

---

**Remember: Select only what you need. Your database and users will thank you!** 🚀
`;






