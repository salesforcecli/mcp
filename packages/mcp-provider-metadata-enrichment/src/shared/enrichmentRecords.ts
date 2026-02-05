/*
 * Copyright 2026, Salesforce, Inc.
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

/*
 * This is a modified copy of EnrichmentRecords class from plugin-metadata-enrichment solely for use within MCP provider.
 * TODO - Move this class to common metadata-enrichment library to be used by both use cases.
 */

import type { SourceComponent } from '@salesforce/source-deploy-retrieve';
import {
  EnrichmentStatus,
  type EnrichmentRequestRecord,
} from '@salesforce/metadata-enrichment';

export class EnrichmentRecords {
  public readonly recordSet: Set<EnrichmentRequestRecord>;

  public constructor(projectSourceComponents: SourceComponent[]) {
    this.recordSet = new Set<EnrichmentRequestRecord>();

    for (const component of projectSourceComponents) {
      const componentName = component.fullName ?? component.name;
      if (componentName && component.type) {
        this.recordSet.add({
          componentName,
          componentType: component.type,
          requestBody: { contentBundles: [], metadataType: 'Generic', maxTokens: 50 },
          response: null,
          message: null,
          status: EnrichmentStatus.NOT_PROCESSED,
        });
      }
    }
  }

  public updateWithResults(results: EnrichmentRequestRecord[]): void {
    const resultsMap = new Map(results.map((r) => [r.componentName, r]));
    for (const record of this.recordSet) {
      const processedResult = resultsMap.get(record.componentName);
      if (processedResult) {
        record.requestBody = processedResult.requestBody;
        record.response = processedResult.response;
        if (record.status !== EnrichmentStatus.SKIPPED) {
          record.status = processedResult.response ? EnrichmentStatus.SUCCESS : EnrichmentStatus.FAIL;
        }
        record.message = processedResult.message;
      }
    }
  }
}
