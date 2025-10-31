/**
 * Fix instructions for Schema.getGlobalDescribe() antipattern
 */
export const GGD_FIX_INSTRUCTIONS = `
# Schema.getGlobalDescribe() Antipattern - Fix Instructions

## Problem
Schema.getGlobalDescribe() is an expensive operation that:
- Consumes significant CPU and memory
- Returns metadata for ALL sObjects in the org
- Is especially problematic when called in loops or frequently executed code paths

## Fix Strategies

### Solution 1: Use Type.forName() for Known sObject Types
When you know the specific sObject type name at compile time or runtime:

**Before:**
\`\`\`apex
Schema.SObjectType objectType = Schema.getGlobalDescribe().get('Account');
\`\`\`

**After:**
\`\`\`apex
Schema.SObjectType objectType = ((SObject)Type.forName('Account').newInstance()).getSObjectType();
\`\`\`

**Important:** Type.forName() returns null if the type doesn't exist. Always check for null:
\`\`\`apex
Type t = Type.forName('Account');
if (t != null) {
    Schema.SObjectType objectType = ((SObject)t.newInstance()).getSObjectType();
}
\`\`\`

### Solution 2: Use Direct SObject References
When working with standard or custom objects known at compile time:

**Before:**
\`\`\`apex
Schema.SObjectType objectType = Schema.getGlobalDescribe().get('Account');
\`\`\`

**After:**
\`\`\`apex
Schema.SObjectType objectType = Account.SObjectType;
\`\`\`

### Solution 3: Cache the Global Describe Result
If you truly need to iterate over multiple sObject types:

**Before:**
\`\`\`apex
for (String objName : objectNames) {
    Schema.SObjectType objType = Schema.getGlobalDescribe().get(objName);
    // process...
}
\`\`\`

**After:**
\`\`\`apex
Map<String, Schema.SObjectType> globalDescribe = Schema.getGlobalDescribe();
for (String objName : objectNames) {
    Schema.SObjectType objType = globalDescribe.get(objName);
    // process...
}
\`\`\`

## Priority Guidelines
- **HIGH/CRITICAL**: GGD called inside loops - fix immediately
- **MEDIUM**: GGD in frequently executed methods - fix during refactoring
- **LOW**: GGD in rarely executed initialization code - monitor but lower priority

## How to Apply These Fixes

For each detected instance:
1. Examine the \`codeBefore\` field to see the problematic code
2. Check the \`severity\` field:
   - **HIGH/CRITICAL**: Instance is in a loop - use caching or refactor
   - **MEDIUM**: Regular usage - replace with Type.forName() or direct reference
3. Identify the sObject type being accessed (if present in the code)
4. Choose the most appropriate solution strategy from above
5. Generate the fixed code with explanatory comments

Be concise but clear in your fixes.
`.trim();
