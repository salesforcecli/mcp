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

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { Args, Parser, ux } from '@oclif/core';
import { pipeline } from '@huggingface/transformers';
import faiss from 'faiss-node';

const normalizeCommandName = (command: string | undefined): string => (command ?? '').split(':').join(' ');

const main = async (): Promise<void> => {
  const {
    args: { outputDir },
  } = await Parser.parse(process.argv.slice(2), {
    args: {
      outputDir: Args.string({
        description: 'Directory to save the output files',
        required: true,
      }),
    },
  });

  if (!outputDir) {
    ux.stderr('Output directory not specified. Please provide a path as the first argument.');
    process.exit(1);
  }

  // Define the output file paths
  const commandsPath = path.join(outputDir, 'sf-commands.json');
  const faissIndexPath = path.join(outputDir, 'faiss-index.bin');

  ux.stderr('Starting offline data preparation...');

  // 1. Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
  }

  // 2. Get Command Data from Salesforce CLI
  ux.stderr('Fetching commands from sf CLI...');
  const rawCommandsJson = execSync('sf commands --json').toString();
  const rawCommands = JSON.parse(rawCommandsJson) as Array<{
    id: string;
    summary?: string;
    flags?: unknown[];
    description?: string;
  }>;

  // 3. Process and Clean the Data
  ux.stderr('Processing and cleaning command data...');
  const commandsData = rawCommands.map((cmd, index: number) => ({
    id: index, // Use our own sequential ID for FAISS
    command: normalizeCommandName(cmd.id),
    summary: cmd.summary ?? 'No summary available.',
    // Create a more descriptive text for better embedding quality
    summaryForEmbedding: `
Command: ${normalizeCommandName(cmd.id)}.
Summary: ${cmd.summary ?? ''}.
Description: ${cmd.description ?? ''}
`,
    flags: cmd.flags ?? [],
  }));

  if (commandsData.length === 0) {
    ux.stderr('No command data could be processed. Is `sf` CLI installed and working?');
    return;
  }

  ux.stderr(`Processed ${commandsData.length} commands.`);

  // 4. Generate Embeddings
  ux.stderr('Loading embedding model... (This may take a moment)');
  const embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
    dtype: 'fp32',
  });

  ux.stderr('Generating embeddings for all commands...');
  const embeddings = await Promise.all(
    commandsData.map((cmd) => embedder(cmd.summaryForEmbedding, { pooling: 'mean', normalize: true }))
  );

  // The output tensor needs to be converted to a flat Float32Array for FAISS
  const embeddingDimension = embeddings[0].dims[1];
  const flattenedEmbeddings = new Float32Array(commandsData.length * embeddingDimension);
  embeddings.forEach((tensor, i) => {
    flattenedEmbeddings.set(tensor.data as Float32Array, i * embeddingDimension);
  });
  ux.stderr(`Generated embeddings with dimension: ${embeddingDimension}`);

  // 5. Build and Save the FAISS Index
  ux.stderr('Building FAISS index...');
  const index = new faiss.IndexFlatL2(embeddingDimension);

  // Convert Float32Array to regular array for faiss-node
  const embeddingsArray = Array.from(flattenedEmbeddings);
  index.add(embeddingsArray);

  const vectorCount = index.ntotal();

  ux.stderr(`FAISS index built with ${String(vectorCount)} vectors.`);
  // Use the correct method name for faiss-node
  index.write(faissIndexPath);
  ux.stderr(`FAISS index saved to: ${faissIndexPath}`);

  // 6. Save the Processed Command Data
  fs.writeFileSync(commandsPath, JSON.stringify(commandsData, null, 2));

  ux.stderr(`Command data saved to: ${commandsPath}`);
  ux.stderr('Offline preparation complete!');
};

main().catch((error: unknown) => {
  // eslint-disable-next-line no-console
  console.error(error);
});
