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

import z from 'zod';

export const EmptySchema = z.object({});

export const TextOutputSchema = z
  .object({
    content: z.string().describe('The tool response content'),
  })
  .describe('Tool response with content');

const LwcFileSchema = z.object({
  path: z.string().describe('path to component file relative to LWC component bundle root'),
  content: z.string().describe('content of the file'),
});

export const LwcCodeSchema = z.object({
  name: z.string().min(1).describe('Name of the LWC component'),
  namespace: z.string().describe('Namespace of the LWC component').default('c'),
  js: LwcFileSchema.describe('LWC component JavaScript file.'),
  html: z.array(LwcFileSchema).min(1).describe('LWC component HTML templates.'),
  css: z.array(LwcFileSchema).optional().describe('LWC component CSS files.'),
  jsMetaXml: LwcFileSchema.optional().describe('LWC component configuration .js-meta.xml file.'),
});

export type LwcCodeType = z.infer<typeof LwcCodeSchema>;
