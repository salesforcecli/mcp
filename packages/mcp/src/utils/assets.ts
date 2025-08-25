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
import fs from 'node:fs';
import { resolve, join } from 'node:path';
import { spawn } from 'node:child_process';
import { FeatureExtractionPipeline } from '@huggingface/transformers';
import faiss from 'faiss-node';
import { pipeline } from '@huggingface/transformers';
import { ux } from '@oclif/core';

type Assets<T> = {
  data: T;
  embedder: FeatureExtractionPipeline;
  index: faiss.IndexFlatL2;
};

/**
 * Conditionally builds or rebuilds a FAISS index based on its existence and age.
 *
 * This function checks if a FAISS index file exists in the specified output directory.
 * If the index exists but is older than one week, it triggers a rebuild. If the index
 * doesn't exist, it initiates the initial build process. The build process can run as a
 * detached child process or in the same process depending on the detached parameter.
 *
 * @param indexPath - The path to the FAISS index file.
 * @param detached - Whether to run the build process detached (default: true)
 */
export async function maybeBuildIndex(indexPath: string, detached = true): Promise<void> {
  try {
    const stats = fs.statSync(indexPath);
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    ux.stderr(`Checking FAISS index in ${indexPath}...`);
    ux.stderr(`Last modified: ${stats.mtime.toString()}`);

    if (stats.mtime < oneWeekAgo) {
      ux.stderr(`FAISS index is more than 1 week old - rebuilding in ${indexPath}...`);
      await spawnBuildScript(indexPath, detached);
    } else {
      ux.stderr(`FAISS index is up to date in ${indexPath}. No rebuild needed.`);
    }
  } catch (error) {
    // File doesn't exist, so build the index
    ux.stderr(`Building FAISS index in ${indexPath}...`);
    await spawnBuildScript(indexPath, detached);
  }
}

function spawnBuildScript(outputDir: string, detached: boolean): Promise<void> {
  const scriptPath = resolve(import.meta.dirname, '..', 'scripts', 'build-index.js');
  const args = [scriptPath, outputDir];

  if (detached) {
    spawn('node', args, {
      detached: true,
      stdio: 'ignore',
    }).unref();
    return Promise.resolve();
  } else {
    return new Promise((res, reject) => {
      const childProcess = spawn('node', args, {
        stdio: 'inherit',
      });

      childProcess.on('close', (code) => {
        if (code === 0) {
          res();
        } else {
          reject(new Error(`Build script exited with code ${code ?? 'UNKNOWN'}`));
        }
      });

      childProcess.on('error', (error) => {
        reject(error);
      });
    });
  }
}

export async function getAssets<T>(dataDir: string, dataPath: string, indexPath: string): Promise<Assets<T>> {
  const fullDataPath = join(dataDir, dataPath);
  const fullIndexPath = join(dataDir, indexPath);

  // Ensure the index is built or rebuilt if necessary
  await maybeBuildIndex(fullIndexPath, false);

  try {
    await fs.promises.access(fullDataPath);
  } catch {
    throw new Error(`Commands file not found at ${fullDataPath}. Please run maybeBuildIndex to build the index.`);
  }

  try {
    await fs.promises.access(fullIndexPath);
  } catch {
    throw new Error(`FAISS index not found at ${fullIndexPath}. Please run maybeBuildIndex to build the index.`);
  }

  try {
    const dataRaw = await fs.promises.readFile(fullDataPath, 'utf-8');
    const data = JSON.parse(dataRaw) as T;
    const index = faiss.IndexFlatL2.read(fullIndexPath);
    const embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
      dtype: 'fp32',
    });

    return {
      data,
      index,
      embedder,
    };
  } catch (error) {
    throw new Error(`Failed to load assets: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
