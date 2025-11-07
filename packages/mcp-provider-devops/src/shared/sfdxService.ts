import {
    ComponentSet,
    ComponentSetBuilder,
    DestructiveChangesType,
    MetadataApiDeploy,
    MetadataApiDeployOptions,
    MetadataResolver,
    NodeFSTreeContainer,
    RegistryAccess,
    RetrieveResult,
    SourceComponent
  } from '@salesforce/source-deploy-retrieve';
import path from 'node:path';

export interface ExtendedSourceComponent extends SourceComponent {
  filePath: string;
}

/**
 * Use the SFDX registry to convert a list of file paths to SourceComponents
 * @param baseDir Absolute or project root directory
 * @param registry SDR RegistryAccess instance
 * @param paths Relative paths from baseDir
 * @param logInfo Optional logger for informational messages
 */
export function convertToSourceComponents(
  baseDir: string,
  registry: RegistryAccess,
  paths: string[],
  logInfo?: (message: string) => void
): ExtendedSourceComponent[] {
  const resolver = new MetadataResolver(registry, undefined, false);
  const results: ExtendedSourceComponent[] = [];
  paths.forEach((p) => {
    try {
      const absPath = path.join(baseDir, p);
      resolver.getComponentsFromPath(absPath).forEach((cs) => {
        results.push({
          ...cs,
          fullName: cs.fullName,
          filePath: absPath
        } as ExtendedSourceComponent);
      });
    } catch (e: any) {
      if (e?.name === 'TypeInferenceError') {
        if (logInfo) {
          logInfo('Unable to determine type for ' + p + ', ignoring');
        }
      } else {
        throw e;
      }
    }
  });
  return results;
}