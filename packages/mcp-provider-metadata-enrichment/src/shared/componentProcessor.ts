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
 * This is a direct copy of ComponentProcessor class from plugin-metadata-enrichment solely for use within MCP provider.
 * TODO - Move this class to common metadata-enrichment library to be used by both use cases.
 */

import { RegistryAccess, type SourceComponent } from '@salesforce/source-deploy-retrieve';
import type { MetadataTypeAndName } from '@salesforce/metadata-enrichment';

export class ComponentProcessor {
  /**
   *
   * Determine the components to SKIP based on the source components and the metadata entries.
   * This includes:
   * - Input components that do not exist in the source project
   * - Non-LWC components
   * - LWC components that are missing their metadata configuration file
   *
   * @param sourceComponents
   * @param metadataEntries
   * @param projectDir
   * @returns
   */
  public static getComponentsToSkip(
    sourceComponents: SourceComponent[],
    metadataEntries: string[],
    projectDir?: string,
  ): Set<MetadataTypeAndName> {
    const requestedComponents = ComponentProcessor.parseRequestedComponents(metadataEntries, projectDir);
    const missingComponents = ComponentProcessor.diffRequestedComponents(sourceComponents, requestedComponents);
    const filteredComponents = ComponentProcessor.filterComponents(sourceComponents, requestedComponents);
    return new Set([...missingComponents, ...filteredComponents]);
  }

  public static filterComponents(
    sourceComponents: SourceComponent[],
    requestedComponents: Set<MetadataTypeAndName | null>,
  ): Set<MetadataTypeAndName> {
    const sourceComponentMap = ComponentProcessor.createSourceComponentMap(sourceComponents);
    const filteredComponents = new Set<MetadataTypeAndName>();

    for (const requestedComponent of requestedComponents) {
      if (!requestedComponent?.componentName) continue;

      const sourceComponent = sourceComponentMap.get(requestedComponent.componentName);
      if (!sourceComponent) continue;

      // Filter out non-LWC components
      if (sourceComponent.type?.name !== 'LightningComponentBundle') {
        filteredComponents.add({
          typeName: sourceComponent.type.name,
          componentName: requestedComponent.componentName,
        });
      }
      // Filter out LWC components that are missing the metadata xml file
      else if (sourceComponent.type?.name === 'LightningComponentBundle' && !sourceComponent.xml) {
        filteredComponents.add({
          typeName: sourceComponent.type.name,
          componentName: requestedComponent.componentName,
        });
      }
    }

    return filteredComponents;
  }

  public static diffRequestedComponents(
    sourceComponents: SourceComponent[],
    requestedComponents: Set<MetadataTypeAndName>,
  ): Set<MetadataTypeAndName> {
    const existingSourceComponentNames = ComponentProcessor.getExistingSourceComponentNames(sourceComponents);
    const missingComponents = new Set<MetadataTypeAndName>();
    for (const requestedComponent of requestedComponents) {
      if (requestedComponent.componentName && !existingSourceComponentNames.has(requestedComponent.componentName)) {
        missingComponents.add(requestedComponent);
      }
    }
    return missingComponents;
  }

  public static parseRequestedComponents(metadataEntries: string[], projectDir?: string): Set<MetadataTypeAndName> {
    const requestedComponents = new Set<MetadataTypeAndName>();

    for (const entry of metadataEntries) {
      const parsed = ComponentProcessor.parseMetadataEntry(entry, projectDir);
      if (!parsed) {
        continue;
      }

      // Ignore wildcarded component names
      if (parsed.componentName?.includes('*')) {
        continue;
      }

      requestedComponents.add(parsed);
    }

    return requestedComponents;
  }

  public static getExistingSourceComponentNames(sourceComponents: SourceComponent[]): Set<string> {
    const existingSourceComponentNames = new Set<string>();
    for (const component of sourceComponents) {
      const componentName = component.fullName ?? component.name;
      if (componentName) {
        existingSourceComponentNames.add(componentName);
      }
    }
    return existingSourceComponentNames;
  }

  public static createSourceComponentMap(sourceComponents: SourceComponent[]): Map<string, SourceComponent> {
    const componentMap = new Map<string, SourceComponent>();

    for (const component of sourceComponents) {
      const componentName = component.fullName ?? component.name;
      if (componentName) {
        componentMap.set(componentName, component);
      }
    }

    return componentMap;
  }

  public static parseMetadataEntry(rawEntry: string, projectDir?: string): MetadataTypeAndName | null {
    try {
      const registry = new RegistryAccess(undefined, projectDir);
      // Split on the first colon, and then join the rest back together to support names that include colons
      const [typeName, ...nameParts] = rawEntry.split(':');
      const type = registry.getTypeByName(typeName.trim());
      if (!type) {
        return null;
      }
      const metadataName = nameParts.length > 0 ? nameParts.join(':').trim() : '*';
      // Return null for wildcards since componentName is required
      if (metadataName === '*') {
        return null;
      }
      return {
        typeName: type.name,
        componentName: metadataName,
      };
    } catch {
      return null;
    }
  }
}
