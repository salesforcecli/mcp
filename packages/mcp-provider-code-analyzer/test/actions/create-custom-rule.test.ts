import path from "node:path";
import { fileURLToPath } from "url";
import fs from "node:fs";
import {
    CreateCustomRuleActionImpl,
    CreateCustomRuleInput,
    CreateCustomRuleOutput
} from "../../src/actions/create-custom-rule.js";
import { expect } from "vitest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('CreateCustomRuleActionImpl', () => {
    describe('When valid PMD + Apex input is provided', () => {
        it('should return knowledge base with nodeIndex, nodeInfo, and xpathFunctions', async () => {
            const input: CreateCustomRuleInput = {
                engine: 'pmd',
                language: 'apex'
            };

            const action: CreateCustomRuleActionImpl = new CreateCustomRuleActionImpl();
            const output: CreateCustomRuleOutput = await action.exec(input);

            expect(output.status).toEqual('ready_for_xpath_generation');
            expect(output.knowledgeBase).toBeDefined();
            expect(output.knowledgeBase?.nodeIndex).toBeDefined();
            expect(Array.isArray(output.knowledgeBase?.nodeIndex)).toBe(true);
            expect(output.knowledgeBase?.nodeIndex.length).toBeGreaterThan(0);
            expect(output.knowledgeBase?.nodeInfo).toBeDefined();
            expect(typeof output.knowledgeBase?.nodeInfo).toBe('object');
            expect(output.knowledgeBase?.xpathFunctions).toBeDefined();
            expect(Array.isArray(output.knowledgeBase?.xpathFunctions)).toBe(true);
            expect(output.instructionsForLlm).toBeDefined();
            expect(output.instructionsForLlm).toContain('PMD XPath rule configuration');
            expect(output.nextStep).toBeDefined();
            expect(output.nextStep?.action).toContain('Generate XPath rule configuration');
            expect(output.nextStep?.then).toContain('apply_code_analyzer_custom_rule');
        });

        it('should include common Apex AST nodes in nodeIndex', async () => {
            const input: CreateCustomRuleInput = {
                engine: 'pmd',
                language: 'apex'
            };

            const action: CreateCustomRuleActionImpl = new CreateCustomRuleActionImpl();
            const output: CreateCustomRuleOutput = await action.exec(input);

            const nodeIndex = output.knowledgeBase?.nodeIndex || [];
            // Check for some common Apex nodes
            expect(nodeIndex).toContain('UserClass');
            expect(nodeIndex).toContain('Method');
            expect(nodeIndex).toContain('MethodCallExpression');
            expect(nodeIndex).toContain('ModifierNode');
        });

        it('should include node details in nodeInfo', async () => {
            const input: CreateCustomRuleInput = {
                engine: 'pmd',
                language: 'apex'
            };

            const action: CreateCustomRuleActionImpl = new CreateCustomRuleActionImpl();
            const output: CreateCustomRuleOutput = await action.exec(input);

            const nodeInfo = output.knowledgeBase?.nodeInfo || {};
            expect(nodeInfo['UserClass']).toBeDefined();
            expect(nodeInfo['UserClass'].description).toBeDefined();
            expect(nodeInfo['UserClass'].attributes).toBeDefined();
            expect(Array.isArray(nodeInfo['UserClass'].attributes)).toBe(true);
        });

        it('should include XPath functions in xpathFunctions', async () => {
            const input: CreateCustomRuleInput = {
                engine: 'pmd',
                language: 'apex'
            };

            const action: CreateCustomRuleActionImpl = new CreateCustomRuleActionImpl();
            const output: CreateCustomRuleOutput = await action.exec(input);

            const xpathFunctions = output.knowledgeBase?.xpathFunctions || [];
            expect(xpathFunctions.length).toBeGreaterThan(0);
            // Check that functions have required properties
            if (xpathFunctions.length > 0) {
                expect(xpathFunctions[0]).toHaveProperty('name');
                expect(xpathFunctions[0]).toHaveProperty('syntax');
                expect(xpathFunctions[0]).toHaveProperty('desc');
            }
        });

        it('should handle case-insensitive language input', async () => {
            const input: CreateCustomRuleInput = {
                engine: 'pmd',
                language: 'APEX' // uppercase
            };

            const action: CreateCustomRuleActionImpl = new CreateCustomRuleActionImpl();
            const output: CreateCustomRuleOutput = await action.exec(input);

            expect(output.status).toEqual('ready_for_xpath_generation');
            expect(output.knowledgeBase).toBeDefined();
        });
    });

    describe('When unsupported engine is provided', () => {
        it('should return error for eslint engine', async () => {
            const input: CreateCustomRuleInput = {
                engine: 'eslint',
                language: 'javascript'
            };

            const action: CreateCustomRuleActionImpl = new CreateCustomRuleActionImpl();
            const output: CreateCustomRuleOutput = await action.exec(input);

            expect(output.status).toEqual('error');
            expect(output.error).toContain('does not support custom rules');
            expect(output.knowledgeBase).toBeUndefined();
        });

        it('should return error for regex engine', async () => {
            const input: CreateCustomRuleInput = {
                engine: 'regex',
                language: 'apex'
            };

            const action: CreateCustomRuleActionImpl = new CreateCustomRuleActionImpl();
            const output: CreateCustomRuleOutput = await action.exec(input);

            expect(output.status).toEqual('error');
            expect(output.error).toContain('does not support custom rules');
        });
    });

    describe('When unsupported language is provided', () => {
        it('should return error for unsupported language with PMD', async () => {
            const input: CreateCustomRuleInput = {
                engine: 'pmd',
                language: 'javascript'
            };

            const action: CreateCustomRuleActionImpl = new CreateCustomRuleActionImpl();
            const output: CreateCustomRuleOutput = await action.exec(input);

            expect(output.status).toEqual('error');
            expect(output.error).toContain('support is not yet added');
            expect(output.error).toContain('Currently supported languages: apex');
        });

        it('should return error for typescript language', async () => {
            const input: CreateCustomRuleInput = {
                engine: 'pmd',
                language: 'typescript'
            };

            const action: CreateCustomRuleActionImpl = new CreateCustomRuleActionImpl();
            const output: CreateCustomRuleOutput = await action.exec(input);

            expect(output.status).toEqual('error');
            expect(output.error).toContain('support is not yet added');
        });
    });

    describe('When knowledge base files are missing', () => {
        it('should return error when AST reference file is missing', async () => {
            const invalidPath = path.join(__dirname, '..', 'fixtures', 'non-existent-path');
            const action: CreateCustomRuleActionImpl = new CreateCustomRuleActionImpl(invalidPath);

            const input: CreateCustomRuleInput = {
                engine: 'pmd',
                language: 'apex'
            };

            const output: CreateCustomRuleOutput = await action.exec(input);

            expect(output.status).toEqual('error');
            expect(output.error).toContain('Knowledge base file not found');
            expect(output.error).toContain('apex-ast-reference.json');
        });

        it('should return error when XPath functions file is missing', async () => {
            // Create a temporary directory with only AST reference
            const tempDir = path.join(__dirname, '..', 'fixtures', 'temp-kb');
            const pmdDir = path.join(tempDir, 'pmd');
            
            try {
                fs.mkdirSync(pmdDir, { recursive: true });
                // Copy AST reference but not XPath functions
                const realAstPath = path.join(__dirname, '..', '..', 'src', 'resources', 'custom-rules', 'pmd', 'apex-ast-reference.json');
                const tempAstPath = path.join(pmdDir, 'apex-ast-reference.json');
                fs.copyFileSync(realAstPath, tempAstPath);

                const action: CreateCustomRuleActionImpl = new CreateCustomRuleActionImpl(tempDir);
                const input: CreateCustomRuleInput = {
                    engine: 'pmd',
                    language: 'apex'
                };

                const output: CreateCustomRuleOutput = await action.exec(input);

                expect(output.status).toEqual('error');
                expect(output.error).toContain('Knowledge base file not found');
                expect(output.error).toContain('xpath-functions.json');
            } finally {
                // Cleanup
                if (fs.existsSync(tempDir)) {
                    fs.rmSync(tempDir, { recursive: true, force: true });
                }
            }
        });
    });

    describe('When custom knowledge base path is provided', () => {
        it('should use custom path when provided', async () => {
            const customPath = path.join(__dirname, '..', '..', 'src', 'resources', 'custom-rules');
            const action: CreateCustomRuleActionImpl = new CreateCustomRuleActionImpl(customPath);

            const input: CreateCustomRuleInput = {
                engine: 'pmd',
                language: 'apex'
            };

            const output: CreateCustomRuleOutput = await action.exec(input);

            expect(output.status).toEqual('ready_for_xpath_generation');
            expect(output.knowledgeBase).toBeDefined();
        });
    });

    describe('When invalid JSON in knowledge base files', () => {
        it('should return error when AST reference JSON is invalid', async () => {
            const tempDir = path.join(__dirname, '..', 'fixtures', 'temp-kb-invalid');
            const pmdDir = path.join(tempDir, 'pmd');
            
            try {
                fs.mkdirSync(pmdDir, { recursive: true });
                // Create invalid JSON file
                const invalidAstPath = path.join(pmdDir, 'apex-ast-reference.json');
                fs.writeFileSync(invalidAstPath, '{ invalid json }', 'utf-8');

                const action: CreateCustomRuleActionImpl = new CreateCustomRuleActionImpl(tempDir);
                const input: CreateCustomRuleInput = {
                    engine: 'pmd',
                    language: 'apex'
                };

                const output: CreateCustomRuleOutput = await action.exec(input);

                expect(output.status).toEqual('error');
                expect(output.error).toContain('Failed to prepare context');
            } finally {
                // Cleanup
                if (fs.existsSync(tempDir)) {
                    fs.rmSync(tempDir, { recursive: true, force: true });
                }
            }
        });
    });
});

