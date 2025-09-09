/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: MIT
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
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
  html: z.array(LwcFileSchema).min(1).describe('LWC component HTML templates.'),
  js: z.array(LwcFileSchema).min(1).describe('LWC component JavaScript files.'),
  css: z.array(LwcFileSchema).describe('LWC component CSS files.'),
  jsMetaXml: LwcFileSchema.describe('LWC component configuration .js-meta.xml file.'),
});

export type LwcCodeType = z.TypeOf<typeof LwcCodeSchema>;
