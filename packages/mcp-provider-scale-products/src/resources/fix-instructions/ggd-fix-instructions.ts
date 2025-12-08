/**
 * Fix instructions for Schema.getGlobalDescribe() antipattern
 */
export const GGD_FIX_INSTRUCTIONS = `
# Schema.getGlobalDescribe() Antipattern - Fix Instructions

## Overview
Schema.getGlobalDescribe() is a computationally expensive operation that retrieves schema information for **all** SObjects in the org. This method should be used sparingly and optimally to avoid performance degradation and governor limit breaches.

## Common Issues
- Causes governor limit breaches due to excessive schema retrieval
- Increases CPU usage and latency
- Results in redundant schema retrieval when called multiple times
- Decreases overall system performance

---

## Antipattern 1: Schema.getGlobalDescribe() Inside a Loop
**Severity: HIGH/CRITICAL**

### Problem
Calling \`Schema.getGlobalDescribe()\` inside a loop causes repeated retrieval of all SObject metadata, leading to severe performance overhead.

### Example of Antipattern
\`\`\`apex
public class ObjectMetadataHandler {
    public void processObjectNames(List<String> objectNames) {
        for (String objectName : objectNames) {
            // ❌ BAD: getGlobalDescribe() called in every loop iteration
            if (Schema.getGlobalDescribe().containsKey(objectName)) {
                Schema.SObjectType sObjectType = Schema.getGlobalDescribe().get(objectName);
                System.debug('Object found: ' + objectName);
            } else {
                System.debug('Object not found: ' + objectName);
            }
        }
    }
}
\`\`\`

### Recommended Fix
Cache the result of \`Schema.getGlobalDescribe()\` outside the loop and reuse it:

\`\`\`apex
public class ObjectMetadataHandler {
    // ✅ GOOD: Cache the result at class level or before the loop
    private static Map<String, Schema.SObjectType> objectMap = Schema.getGlobalDescribe();

    public void processObjectNames(List<String> objectNames) {
        for (String objectName : objectNames) {
            // Use the cached objectMap to access SObjectType
            if (objectMap.containsKey(objectName)) {
                Schema.SObjectType sObjectType = objectMap.get(objectName);
                System.debug('Object found: ' + objectName);
            } else {
                System.debug('Object not found: ' + objectName);
            }
        }
    }
}
\`\`\`


### Example of Antipattern
\`\`\`apex
/**
     * ANTI-PATTERN : Schema.getGlobalDescribe() inside a loop
     * This is extremely inefficient as it calls getGlobalDescribe() multiple times
     */
    public void schemaGetGlobalDescribeInLoop() {
        List<String> objectNames = new List<String>{'Account', 'Contact', 'Opportunity', 'Lead', 'Case'};
        
        // ANTI-PATTERN: Calling Schema.getGlobalDescribe() inside a loop
        // This causes the expensive getGlobalDescribe() operation to be called multiple times
        for (String objectName : objectNames) {
            // ANTI-PATTERN: This is called 5 times in this loop!
            Schema.DescribeSObjectResult dsr = Schema.getGlobalDescribe().get(objectName).getDescribe();
            System.debug('Object ' + objectName + ' label: ' + dsr.getLabel());
        }
    }
\`\`\`



### Recommended Fix
Cache the result of \`Schema.getGlobalDescribe()\` outside the loop and reuse it:

\`\`\`apex
// FIX: Use Type.forName() for dynamic object names
        for (String objectName : objectNames) {
            Type objType = Type.forName(objectName);
            if (objType != null) {
                SObject instance = (SObject)objType.newInstance();
                Schema.DescribeSObjectResult dsr = instance.getSObjectType().getDescribe();
                System.debug('Object ' + objectName + ' label: ' + dsr.getLabel());
            }
        }
\`\`\`

---

## Antipattern 2: Multiple Schema.getGlobalDescribe() Calls Within a Class/Method
**Severity: MEDIUM**

### Problem
Multiple calls to \`Schema.getGlobalDescribe()\` within the same method or class result in redundant schema retrieval, wasting CPU and potentially hitting governor limits.

### Example of Antipattern
\`\`\`apex
public void processObject(String objectName) {
    // ❌ BAD: First call to getGlobalDescribe()
    Schema.DescribeSObjectResult describeResult = Schema.getGlobalDescribe().get(objectName).getDescribe();
    
    System.debug('Object Label: ' + describeResult.getLabel());
    System.debug('Object Plural Label: ' + describeResult.getLabelPlural());

    // ❌ BAD: Second call to getGlobalDescribe()
    SObject newRecord = Schema.getGlobalDescribe().get(objectName).newSObject();
    
    newRecord.put('Name', 'Address');
    insert newRecord;
    
    System.debug('New record created with ID: ' + newRecord.Id);
}
\`\`\`

### Recommended Fix
Optimize the design by using \`Schema.describeSObjects()\` for describe operations and \`Type.forName()\` for object instantiation:

\`\`\`apex
public void processObject(String objectName) {
    // ✅ GOOD: Use describeSObjects() for describe operations
    Schema.DescribeSObjectResult describeResult = null;
    try {
        List<Schema.DescribeSObjectResult> describes = Schema.describeSObjects(
            new String[] { objectName }, 
            SObjectDescribeOptions.DEFERRED
        );
        describeResult = describes[0];
    } catch (InvalidParameterValueException ipve) {
        describeResult = null;
    }
    
    if (describeResult != null) {
        System.debug('Object Label: ' + describeResult.getLabel());
        System.debug('Object Plural Label: ' + describeResult.getLabelPlural());
    }

    // ✅ GOOD: Use Type.forName() for object instantiation
    SObject newRecord = (SObject)Type.forName(objectName).newInstance();
    
    newRecord.put('Name', 'Address');
    insert newRecord;
    
    System.debug('New record created with ID: ' + newRecord.Id);
}
\`\`\`

---

## Antipattern 3: Inefficient Usage for Known SObjects
**Severity: MEDIUM**

### Problem
Using \`Schema.getGlobalDescribe()\` to retrieve metadata for a single known SObject is inefficient. It retrieves metadata for **all** SObjects when you only need one.

### Example of Antipattern
\`\`\`apex
// ❌ BAD: Using getGlobalDescribe() for a known SObject
Schema.DescribeSObjectResult dsr = Schema.getGlobalDescribe().get('Case').getDescribe();
\`\`\`

### Recommended Fix
Use \`getSObjectType()\` or \`sObjectType.getDescribe()\` for known SObjects:

\`\`\`apex
// ✅ GOOD: Direct reference to the SObject type
Schema.DescribeSObjectResult dsr = Case.sObjectType.getDescribe();
\`\`\`

For dynamic object names at runtime, use \`Type.forName()\`:
\`\`\`apex
// ✅ GOOD: For dynamic object names
Type objType = Type.forName(objectName);
if (objType != null) {
    SObject instance = (SObject)objType.newInstance();
    Schema.SObjectType sObjType = instance.getSObjectType();
    Schema.DescribeSObjectResult dsr = sObjType.getDescribe();
}
\`\`\`

---

## Best Practices Summary

1. **Never call \`Schema.getGlobalDescribe()\` inside loops** - Cache it outside and reuse
2. **Minimize multiple calls** - Call once and cache the result
3. **Use lightweight alternatives for known SObjects**:
   - \`sObjectType.getDescribe()\` for known objects
   - \`Schema.describeSObjects()\` for describe operations
   - \`Type.forName()\` for dynamic object instantiation
4. **Cache at class level** when the data is used across multiple methods
5. **Optimize the design** - Question whether \`getGlobalDescribe()\` is truly necessary

## How to Apply These Fixes

For each detected instance:
1. Examine the \`severity\` field:
   - **HIGH**: Inside a loop - apply Antipattern 1 fix immediately
   - **MEDIUM**: Multiple calls or known SObject - apply Antipattern 2 or 3 fix
2. Review the \`codeBefore\` field to understand the context
3. Identify if the SObject type is known at compile time or dynamic
4. Choose the appropriate solution pattern from above
5. Generate the fixed code with explanatory comments

## Reference
- [Apex Schema Class Documentation](https://developer.salesforce.com/docs/atlas.en-us.apexref.meta/apexref/apex_methods_system_schema.htm#apex_System_Schema_getGlobalDescribe)

Be concise but clear in your fixes.
`.trim();
