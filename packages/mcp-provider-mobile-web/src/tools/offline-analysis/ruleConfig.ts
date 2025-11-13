/*
 * Copyright 2025, Salesforce, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { CodeAnalysisBaseIssueType } from '../../schemas/analysisSchema.js';
import dedent from 'dedent';

export interface RuleConfig {
  id: string; //ESLint rule id
  config: CodeAnalysisBaseIssueType;
}
// ********** Rule: no-private-wire-config-property **********
const NO_PRIVATE_WIRE_CONFIG_RULE_ID = '@salesforce/lwc-graph-analyzer/no-private-wire-config-property';

const noPrivateWireRule: CodeAnalysisBaseIssueType = {
  type: 'Private Wire Configuration Property',
  description:
    'Properties used in wire configurations must be decorated with @api to be public and resolvable by the wire service.',
  intentAnalysis:
    'The developer used properties in wire configurations without making them public using the @api decorator.',

  suggestedAction: dedent`
        Make the properties public by using the @api decorator:
        - Add @api decorator to properties used in wire configurations
      `,
};

// ********** Rule: no-wire-config-references-non-local-property-reactive-value **********
const NO_WIRE_CONFIG_REFERENCES_NON_LOCAL_PROPERTY_REACTIVE_VALUE_RULE_ID =
  '@salesforce/lwc-graph-analyzer/no-wire-config-references-non-local-property-reactive-value';

const noWireConfigReferenceNonLocalPropertyRule: CodeAnalysisBaseIssueType = {
  type: 'Wire Configuration References Non-Local Property',
  description:
    'Wire configurations with reactive values ($prop) must reference only component properties, not imported values or values defined outside the component class.',
  intentAnalysis:
    'The developer is trying to use a non-local value (imported or module-level) as a reactive parameter in a wire configuration.',

  suggestedAction: dedent`
        Wrap the non-local value in a getter:
        - Introduce a getter which returns the imported value or the value of a module-level constant
        - Update the wire configuration to use the getter name as the reactive parameter
        Example:
            // Instead of:
            @wire(getData, { param: '$importedValue' })
            
            // Use:
            get localValue() {
                return importedValue;
            }
            @wire(getData, { param: '$localValue' })
      `,
};

const noPrivateWireRuleConfig: RuleConfig = {
  id: NO_PRIVATE_WIRE_CONFIG_RULE_ID,
  config: noPrivateWireRule,
};

const noWireConfigReferenceNonLocalPropertyRuleConfig: RuleConfig = {
  id: NO_WIRE_CONFIG_REFERENCES_NON_LOCAL_PROPERTY_REACTIVE_VALUE_RULE_ID,
  config: noWireConfigReferenceNonLocalPropertyRule,
};

// **********  getter related violations **********
const getterViolation: CodeAnalysisBaseIssueType = {
  type: 'Violations in Getter',
  description: 'A getter method does more than just returning a value',
  intentAnalysis:
    'The developer attempted to modify component state, prepare data for consumption, or reference functions within a getter function.',
  suggestedAction: dedent`
        # Compliant getter implementations

        Getters that:
        - Directly access and return property values
        - Return a literal value
        - Compute and return values derived from existing properties

        # Non-compliant getter implementations

        ## Violation: getters that call functions

        Getters that call functions cannot be primed for offline use cases.

        ### Remediation

        Reorganize any getter implementation code that calls a function, to move such calls out of the getter. Avoid invoking any function calls within getters.

        ## Violation: getters with side effects

        Getters that assign values to member variables or modify state create unpredictable side effects and are not suitable for offline scenarios.

        ### Remediation

        Never assign values to member variables within a getter. LWC getters should only retrieve data without modifying any state. If you need to compute and cache a value, perform the computation and assignment in a lifecycle hook or method, then have the getter simply return the cached value.

        ## Violation: getters that do more than just return a value

        Getters that perform complex operations beyond returning a value cannot be primed for offline use cases.

        ### Remediation

        Review the getters and make sure that they're composed to only return a value. Move any complex logic, data processing, or multiple operations into separate methods or lifecycle hooks, and have the getter simply return the result.
      `,
};

// ********** Rule: no-assignment-expression-assigns-value-to-member-variable **********
const NO_ASSIGNMENT_EXPRESSION_ASSIGNS_VALUE_TO_MEMBER_VARIABLE_RULE_ID =
  '@salesforce/lwc-graph-analyzer/no-assignment-expression-assigns-value-to-member-variable';
const noAssignmentExpressionAssignsValueToMemberVariableRuleConfig: RuleConfig = {
  id: NO_ASSIGNMENT_EXPRESSION_ASSIGNS_VALUE_TO_MEMBER_VARIABLE_RULE_ID,
  config: getterViolation,
};

// ********** Rule: no-reference-to-class-functions **********
const NO_REFERENCE_TO_CLASS_FUNCTIONS_RULE_ID = '@salesforce/lwc-graph-analyzer/no-reference-to-class-functions';
const noReferenceToClassFunctionsRuleConfig: RuleConfig = {
  id: NO_REFERENCE_TO_CLASS_FUNCTIONS_RULE_ID,
  config: getterViolation,
};

// ********** Rule: no-reference-to-module-functions **********
const NO_REFERENCE_TO_MODULE_FUNCTIONS_RULE_ID = '@salesforce/lwc-graph-analyzer/no-reference-to-module-functions';
const noReferenceToModuleFunctionsRuleConfig: RuleConfig = {
  id: NO_REFERENCE_TO_MODULE_FUNCTIONS_RULE_ID,
  config: getterViolation,
};

// ********** Rule: no-getter-contains-more-than-return-statement **********
const NO_GETTER_CONTAINS_MORE_THAN_RETURN_STATEMENT_RULE_ID =
  '@salesforce/lwc-graph-analyzer/no-getter-contains-more-than-return-statement';
const noGetterContainsMoreThanReturnStatementRuleConfig: RuleConfig = {
  id: NO_GETTER_CONTAINS_MORE_THAN_RETURN_STATEMENT_RULE_ID,
  config: getterViolation,
};

// ********** Rule: no-unsupported-member-variable-in-member-expression **********
const NO_UNSUPPORTED_MEMBER_VARIABLE_IN_MEMBER_EXPRESSION_RULE_ID =
  '@salesforce/lwc-graph-analyzer/no-unsupported-member-variable-in-member-expression';
const noUnsupportedMemberVariableInMemberExpressionRuleConfig: RuleConfig = {
  id: NO_UNSUPPORTED_MEMBER_VARIABLE_IN_MEMBER_EXPRESSION_RULE_ID,
  config: getterViolation,
};

export const ruleConfigs: RuleConfig[] = [
  noPrivateWireRuleConfig,
  noWireConfigReferenceNonLocalPropertyRuleConfig,
  noAssignmentExpressionAssignsValueToMemberVariableRuleConfig,
  noReferenceToClassFunctionsRuleConfig,
  noReferenceToModuleFunctionsRuleConfig,
  noGetterContainsMoreThanReturnStatementRuleConfig,
  noUnsupportedMemberVariableInMemberExpressionRuleConfig,
];
