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
import faiss from 'faiss-node';
import { pipeline, FeatureExtractionPipeline } from '@xenova/transformers';
import { ux } from '@oclif/core';

type CommandData = {
  id: number;
  command: string;
  summary: string;
  summaryForEmbedding: string;
};

type Assets = {
  commands: CommandData[];
  commandNames: string[];
  faissIndex: faiss.IndexFlatL2;
  embedder: FeatureExtractionPipeline;
};

let CACHED_DATA_DIR: string | null = null;

/**
 * Conditionally builds or rebuilds a FAISS index based on its existence and age.
 *
 * This function checks if a FAISS index file exists in the specified output directory.
 * If the index exists but is older than one week, it triggers a rebuild. If the index
 * doesn't exist, it initiates the initial build process. The build process can run as a
 * detached child process or in the same process depending on the detached parameter.
 *
 * @param outputDir - The directory path where the FAISS index should be located or created
 * @param detached - Whether to run the build process detached (default: true)
 *
 * @remarks
 * - Sets the global CACHED_DATA_DIR variable to the provided outputDir. This is used to locate the index file.
 */
export async function maybeBuildIndex(outputDir: string, detached = true): Promise<void> {
  CACHED_DATA_DIR = outputDir;

  const faissIndexPath = join(outputDir, 'faiss-index.bin');

  try {
    const stats = fs.statSync(faissIndexPath);
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    ux.stderr(`Checking FAISS index in ${outputDir}...`);
    ux.stderr(`Last modified: ${stats.mtime.toString()}`);

    if (stats.mtime < oneWeekAgo) {
      ux.stderr(`FAISS index is more than 1 week old - rebuilding in ${outputDir}...`);
      await spawnBuildScript(outputDir, detached);
    } else {
      ux.stderr(`FAISS index is up to date in ${outputDir}. No rebuild needed.`);
    }
  } catch (error) {
    // File doesn't exist, so build the index
    ux.stderr(`Building FAISS index in ${outputDir}...`);
    await spawnBuildScript(outputDir, detached);
  }
}

function spawnBuildScript(outputDir: string, detached: boolean): Promise<void> {
  const scriptPath = resolve(import.meta.dirname, 'scripts', 'build-index.js');
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

export async function getAssets(): Promise<Assets> {
  if (!CACHED_DATA_DIR) {
    throw new Error('Data directory not set. Please call maybeBuildIndex first.');
  }

  // Ensure the index is built or rebuilt if necessary
  await maybeBuildIndex(CACHED_DATA_DIR, false);

  const commandsPath = join(CACHED_DATA_DIR, 'sf-commands.json');
  const faissIndexPath = join(CACHED_DATA_DIR, 'faiss-index.bin');

  try {
    await fs.promises.access(commandsPath);
  } catch {
    throw new Error(`Commands file not found at ${commandsPath}. Please run maybeBuildIndex to build the index.`);
  }

  try {
    await fs.promises.access(faissIndexPath);
  } catch {
    throw new Error(`FAISS index not found at ${faissIndexPath}. Please run maybeBuildIndex to build the index.`);
  }

  try {
    const commandsData = await fs.promises.readFile(commandsPath, 'utf-8');
    const commands = JSON.parse(commandsData) as CommandData[];
    const faissIndex = faiss.IndexFlatL2.read(faissIndexPath);
    const embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');

    return {
      commands,
      commandNames: commands.map((cmd) => cmd.command),
      faissIndex,
      embedder,
    };
  } catch (error) {
    throw new Error(`Failed to load assets: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
