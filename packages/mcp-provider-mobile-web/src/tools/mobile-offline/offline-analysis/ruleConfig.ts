/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: MIT
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
 */
import { CodeAnalysisBaseIssueType } from '../../../schemas/analysisSchema.js';
import dedent from 'dedent';

export interface RuleConfig {
  id: string; //ESLint rule id
  config: CodeAnalysisBaseIssueType;
}
// ********** Rules: no-private-wire-config-property **********
const NO_PRIVATE_WIRE_CONFIG_RULE_ID =
  '@salesforce/lwc-graph-analyzer/no-private-wire-config-property';

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

// ********** Rules: no-wire-config-references-non-local-property-reactive-value **********
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

export const ruleConfigs: RuleConfig[] = [
  noPrivateWireRuleConfig,
  noWireConfigReferenceNonLocalPropertyRuleConfig,
];
