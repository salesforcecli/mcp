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
        it('should return knowledge base with availableNodes (optimized - strings only)', async () => {
            const input: CreateCustomRuleInput = {
                engine: 'pmd',
                language: 'apex'
            };

            const action: CreateCustomRuleActionImpl = new CreateCustomRuleActionImpl();
            const output: CreateCustomRuleOutput = await action.exec(input);

            expect(output.status).toEqual('ready_for_xpath_generation');
            expect(output.knowledgeBase).toBeDefined();
            expect(output.knowledgeBase?.availableNodes).toBeDefined();
            expect(Array.isArray(output.knowledgeBase?.availableNodes)).toBe(true);
            expect(output.knowledgeBase?.availableNodes.length).toBeGreaterThan(0);
            expect(output.knowledgeBase?.nodeCount).toBeDefined();
            expect(output.knowledgeBase?.nodeCount).toBeGreaterThan(0);
            expect(output.instructionsForLlm).toBeDefined();
            expect(output.instructionsForLlm).toContain('XPath');
            expect(output.nextStep).toBeDefined();
            expect(output.nextStep?.action).toContain('get_code_analyzer_node_details');
            expect(output.nextStep?.then).toContain('apply_code_analyzer_custom_rule');
        });

        it('should include common Apex AST nodes in availableNodes (as strings)', async () => {
            const input: CreateCustomRuleInput = {
                engine: 'pmd',
                language: 'apex'
            };

            const action: CreateCustomRuleActionImpl = new CreateCustomRuleActionImpl();
            const output: CreateCustomRuleOutput = await action.exec(input);

            const availableNodes = output.knowledgeBase?.availableNodes || [];
            // availableNodes is now an array of strings (node names only)
            expect(availableNodes).toContain('UserClass');
            expect(availableNodes).toContain('Method');
            expect(availableNodes).toContain('MethodCallExpression');
            expect(availableNodes).toContain('ModifierNode');
            // Verify structure is array of strings
            if (availableNodes.length > 0) {
                expect(typeof availableNodes[0]).toBe('string');
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

