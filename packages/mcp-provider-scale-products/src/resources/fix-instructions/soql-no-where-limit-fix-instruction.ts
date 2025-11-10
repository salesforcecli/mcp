/**
 * Returns fix instructions for SOQL queries without WHERE or LIMIT clauses
 */
export function getSOQLNoWhereLimitFixInstructions(): string {
    return `
  ## SOQL Without WHERE or LIMIT Clause Antipattern
  
  ### Problem
  SOQL queries without WHERE clauses or LIMIT statements can retrieve excessive records, causing:
  - Governor limit exceptions (max 50,000 rows)
  - Poor performance and slow page loads
  - Heap size limit exceptions
  - Inefficient resource utilization
  
  ### Solution
  Always add appropriate filtering and limits to SOQL queries:
  
  1. **Add WHERE Clause**: Filter records based on business logic
     \`\`\`apex
     // Bad
     List<Account> accounts = [SELECT Id, Name FROM Account];
     
     // Good
     List<Account> accounts = [SELECT Id, Name FROM Account WHERE Status__c = 'Active'];
     \`\`\`
  
  2. **Add LIMIT Clause**: Restrict the number of records returned
     \`\`\`apex
     // Bad
     List<Contact> contacts = [SELECT Id, Email FROM Contact];
     
     // Good
     List<Contact> contacts = [SELECT Id, Email FROM Contact LIMIT 100];
     \`\`\`
  
  3. **Combine WHERE and LIMIT**: Use both for optimal performance
     \`\`\`apex
     // Best Practice
     List<Opportunity> opps = [
       SELECT Id, Name, Amount 
       FROM Opportunity 
       WHERE CloseDate = THIS_YEAR AND StageName = 'Closed Won'
       LIMIT 1000
     ];
     \`\`\`
  
  4. **For Nested Queries**: Ensure the outer query has WHERE or LIMIT
     \`\`\`apex
     // Bad
     List<Account> accounts = [
       SELECT Id, (SELECT Id FROM Contacts WHERE Email != null)
       FROM Account
     ];
     
     // Good
     List<Account> accounts = [
       SELECT Id, (SELECT Id FROM Contacts WHERE Email != null)
       FROM Account
       WHERE Industry = 'Technology'
       LIMIT 500
     ];
     \`\`\`
  
  ### Best Practices
  - Always consider the data volume in your org
  - Use indexed fields in WHERE clauses for better performance
  - Set realistic LIMIT values based on your use case
  - For batch operations, use Database.QueryLocator instead of List<SObject>
    `.trim();
  }