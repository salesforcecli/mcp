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
import path from 'node:path';
import { spawn } from 'node:child_process';
import { Args, Parser, ux } from '@oclif/core';
import { pipeline } from '@huggingface/transformers';
import faiss from 'faiss-node';

import { Tool } from '@modelcontextprotocol/sdk/types.js';

export type InvocableTool = {
  name: string;
  function: {
    name: string;
    description: string | undefined;
    parameters: Tool['inputSchema'];
    annotations: Tool['annotations'];
  };
};

export const getToolsList = async (): Promise<InvocableTool[]> => {
  const toolsList: string = await new Promise<string>((resolve, reject) => {
    const isWindows = process.platform === 'win32';
    const command = isWindows ? 'npx.cmd' : 'npx';
    const binPath = path.join('bin', 'run.js');

    const child = spawn(
      command,
      [
        '@modelcontextprotocol/inspector',
        '--cli',
        'node',
        binPath,
        '--orgs',
        'DEFAULT_TARGET_ORG',
        '--method',
        'tools/list',
      ],
      {
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: isWindows,
      }
    );

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    child.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Command failed with code ${code}: ${stderr}`));
        return;
      }
      if (stderr) {
        reject(new Error(stderr));
        return;
      }
      resolve(stdout);
    });

    child.on('error', (error) => {
      reject(error);
    });
  });

  const parsedToolsList = JSON.parse(toolsList) as { tools: Tool[] };

  return (parsedToolsList.tools ?? []).map((tool) => ({
    name: tool.name,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema,
      annotations: tool.annotations,
    },
  }));
};

const extractFromDescription = (description: string | undefined): { exampleUsage: string; summary: string } => {
  if (!description) return { exampleUsage: '', summary: '' };

  const exampleUsageMatch = description.match(/EXAMPLE USAGE:\s*(.*?)(?=\n\n|AGENT INSTRUCTIONS:|$)/s);
  const summary = description.split('\n')[0].trim();

  return {
    exampleUsage: exampleUsageMatch?.[1]?.trim() ?? '',
    summary,
  };
};

const main = async (): Promise<void> => {
  const {
    args: { outputDir },
  } = await Parser.parse(process.argv.slice(2), {
    args: {
      outputDir: Args.string({
        description: 'Directory to save the output files',
        default: './assets',
      }),
    },
  });

  if (!outputDir) {
    ux.stderr('Output directory not specified. Please provide a path as the first argument.');
    process.exit(1);
  }

  // Define the output file paths
  const mcpToolsPath = path.join(outputDir, 'sf-mcp-tools.json');
  const faissIndexPath = path.join(outputDir, 'faiss-tools-index.bin');

  ux.stderr('Starting offline data preparation...');

  // 1. Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
  }

  // 2. Get Command Data from Salesforce CLI
  ux.stderr('Fetching commands from sf mcp sever...');
  const rawTools = await getToolsList();

  // 3. Process and Clean the Data
  ux.stderr('Processing and cleaning command data...');

  const toolsData = rawTools.map((tool, index: number) => {
    const { exampleUsage, summary } = extractFromDescription(tool.function.description);
    return {
      id: index, // Use our own sequential ID for FAISS
      name: tool.name,
      description: tool.function.description,
      parameters: tool.function.parameters,
      annotations: tool.function.annotations,
      // Create a more descriptive text for better embedding quality
      // This will be stripped from the final output sent to the LLM to save token count
      embeddingText: `SUMMARY: ${summary}
EXAMPLE USAGE: ${exampleUsage}
PARAMETERS:
${Object.keys(tool.function.parameters.properties ?? {}).join('\n')}`,
    };
  });

  if (toolsData.length === 0) {
    ux.stderr('No tool data could be processed.');
    return;
  }

  ux.stderr(`Processed ${toolsData.length} tools.`);

  // 4. Generate Embeddings
  ux.stderr('Loading embedding model... (This may take a moment)');
  const embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
    dtype: 'fp32',
  });

  ux.stderr('Generating embeddings for all tools...');
  const embeddings = await Promise.all(
    toolsData.map((cmd) => embedder(cmd.embeddingText, { pooling: 'mean', normalize: true }))
  );

  // The output tensor needs to be converted to a flat Float32Array for FAISS
  const embeddingDimension = embeddings[0].dims[1];
  const flattenedEmbeddings = new Float32Array(toolsData.length * embeddingDimension);
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
  fs.writeFileSync(mcpToolsPath, JSON.stringify(toolsData, null, 2));

  ux.stderr(`Command data saved to: ${mcpToolsPath}`);
  ux.stderr('Offline preparation complete!');
};

main().catch((error: unknown) => {
  // eslint-disable-next-line no-console
  console.error(error);
});
