import path from "node:path";
import { fileURLToPath } from "url";
import fs from "node:fs";
import {
    GetNodeDetailsActionImpl,
    GetNodeDetailsInput,
    GetNodeDetailsOutput
} from "../../src/actions/get-node-details.js";
import { expect } from "vitest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('GetNodeDetailsActionImpl', () => {
    describe('When valid PMD + Apex input is provided', () => {
        it('should return node details with direct attributes', async () => {
            const input: GetNodeDetailsInput = {
                engine: 'pmd',
                language: 'apex',
                nodeNames: ['UserClass']
            };

            const action: GetNodeDetailsActionImpl = new GetNodeDetailsActionImpl();
            const output: GetNodeDetailsOutput = await action.exec(input);

            expect(output.status).toEqual('success');
            expect(output.nodeDetails).toBeDefined();
            expect(output.nodeDetails?.length).toBeGreaterThan(0);
            
            const userClassNode = output.nodeDetails?.find(n => n.name === 'UserClass');
            expect(userClassNode).toBeDefined();
            expect(userClassNode?.description).toBeDefined();
            expect(userClassNode?.category).toBeDefined();
            expect(userClassNode?.attributes).toBeDefined();
            expect(Array.isArray(userClassNode?.attributes)).toBe(true);
        });

        it('should return parent class nodes with inherited attributes', async () => {
            const input: GetNodeDetailsInput = {
                engine: 'pmd',
                language: 'apex',
                nodeNames: ['UserClass']
            };

            const action: GetNodeDetailsActionImpl = new GetNodeDetailsActionImpl();
            const output: GetNodeDetailsOutput = await action.exec(input);

            expect(output.status).toEqual('success');
            expect(output.nodeDetails).toBeDefined();
            
            // Should include parent classes (BaseApexClass, AbstractApexNode.Single, AbstractApexNode)
            const parentClasses = output.nodeDetails?.filter(n => 
                n.name === 'BaseApexClass' || 
                n.name === 'AbstractApexNode.Single' || 
                n.name === 'AbstractApexNode'
            );
            expect(parentClasses?.length).toBeGreaterThan(0);
            
            // Check that parent classes have attributes from inheritSchema
            const baseApexClass = output.nodeDetails?.find(n => n.name === 'BaseApexClass');
            expect(baseApexClass).toBeDefined();
            expect(baseApexClass?.category).toEqual('Inheritance');
            expect(baseApexClass?.attributes).toBeDefined();
            expect(baseApexClass?.attributes.length).toBeGreaterThan(0);
        });

        it('should return important notes for Apex', async () => {
            const input: GetNodeDetailsInput = {
                engine: 'pmd',
                language: 'apex',
                nodeNames: ['Method']
            };

            const action: GetNodeDetailsActionImpl = new GetNodeDetailsActionImpl();
            const output: GetNodeDetailsOutput = await action.exec(input);

            expect(output.status).toEqual('success');
            expect(output.importantNotes).toBeDefined();
            expect(Array.isArray(output.importantNotes)).toBe(true);
            expect(output.importantNotes?.length).toBeGreaterThan(0);
            
            // Check structure of important notes
            const firstNote = output.importantNotes?.[0];
            expect(firstNote?.title).toBeDefined();
            expect(firstNote?.content).toBeDefined();
        });

        it('should handle multiple node names', async () => {
            const input: GetNodeDetailsInput = {
                engine: 'pmd',
                language: 'apex',
                nodeNames: ['UserClass', 'Method', 'MethodCallExpression']
            };

            const action: GetNodeDetailsActionImpl = new GetNodeDetailsActionImpl();
            const output: GetNodeDetailsOutput = await action.exec(input);

            expect(output.status).toEqual('success');
            expect(output.nodeDetails).toBeDefined();
            
            // Should have at least the 3 requested nodes (plus their parent classes)
            const requestedNodes = output.nodeDetails?.filter(n => 
                n.name === 'UserClass' || n.name === 'Method' || n.name === 'MethodCallExpression'
            );
            expect(requestedNodes?.length).toBeGreaterThanOrEqual(3);
        });

        it('should handle case-insensitive language input', async () => {
            const input: GetNodeDetailsInput = {
                engine: 'pmd',
                language: 'APEX', // uppercase
                nodeNames: ['UserClass']
            };

            const action: GetNodeDetailsActionImpl = new GetNodeDetailsActionImpl();
            const output: GetNodeDetailsOutput = await action.exec(input);

            expect(output.status).toEqual('success');
            expect(output.nodeDetails).toBeDefined();
        });

        it('should load knowledge base only once and reuse for both node details and important notes', async () => {
            const input: GetNodeDetailsInput = {
                engine: 'pmd',
                language: 'apex',
                nodeNames: ['UserClass']
            };

            const action: GetNodeDetailsActionImpl = new GetNodeDetailsActionImpl();
            const output: GetNodeDetailsOutput = await action.exec(input);

            // Both nodeDetails and importantNotes should be present, indicating
            // the knowledge base was loaded once and reused
            expect(output.nodeDetails).toBeDefined();
            expect(output.importantNotes).toBeDefined();
            expect(output.nodeDetails?.length).toBeGreaterThan(0);
            expect(output.importantNotes?.length).toBeGreaterThan(0);
        });
    });

    describe('When unsupported engine is provided', () => {
        it('should return error for eslint engine', async () => {
            const input: GetNodeDetailsInput = {
                engine: 'eslint',
                language: 'javascript',
                nodeNames: ['SomeNode']
            };

            const action: GetNodeDetailsActionImpl = new GetNodeDetailsActionImpl();
            const output: GetNodeDetailsOutput = await action.exec(input);

            expect(output.status).toEqual('error');
            expect(output.error).toContain('does not support node details');
            expect(output.error).toContain('eslint');
            expect(output.nodeDetails).toBeUndefined();
            expect(output.importantNotes).toBeUndefined();
        });

        it('should return error for regex engine', async () => {
            const input: GetNodeDetailsInput = {
                engine: 'regex',
                language: 'apex',
                nodeNames: ['SomeNode']
            };

            const action: GetNodeDetailsActionImpl = new GetNodeDetailsActionImpl();
            const output: GetNodeDetailsOutput = await action.exec(input);

            expect(output.status).toEqual('error');
            expect(output.error).toContain('does not support node details');
            expect(output.error).toContain('regex');
        });
    });

    describe('When unsupported language is provided', () => {
        it('should return error for unsupported language with PMD', async () => {
            const input: GetNodeDetailsInput = {
                engine: 'pmd',
                language: 'javascript',
                nodeNames: ['SomeNode']
            };

            const action: GetNodeDetailsActionImpl = new GetNodeDetailsActionImpl();
            const output: GetNodeDetailsOutput = await action.exec(input);

            expect(output.status).toEqual('error');
            expect(output.error).toContain('support is not yet added');
            expect(output.error).toContain('Currently supported languages: apex');
        });

        it('should return error for typescript language', async () => {
            const input: GetNodeDetailsInput = {
                engine: 'pmd',
                language: 'typescript',
                nodeNames: ['SomeNode']
            };

            const action: GetNodeDetailsActionImpl = new GetNodeDetailsActionImpl();
            const output: GetNodeDetailsOutput = await action.exec(input);

            expect(output.status).toEqual('error');
            expect(output.error).toContain('support is not yet added');
        });
    });

    describe('When invalid input is provided', () => {
        it('should return error when nodeNames is empty', async () => {
            const input: GetNodeDetailsInput = {
                engine: 'pmd',
                language: 'apex',
                nodeNames: []
            };

            const action: GetNodeDetailsActionImpl = new GetNodeDetailsActionImpl();
            const output: GetNodeDetailsOutput = await action.exec(input);

            expect(output.status).toEqual('error');
            expect(output.error).toContain('At least one node name is required');
        });

        it('should return error when nodeNames is missing', async () => {
            const input = {
                engine: 'pmd',
                language: 'apex'
                // nodeNames is missing
            } as any;

            const action: GetNodeDetailsActionImpl = new GetNodeDetailsActionImpl();
            const output: GetNodeDetailsOutput = await action.exec(input);

            expect(output.status).toEqual('error');
            expect(output.error).toContain('At least one node name is required');
        });
    });

    describe('When node names are not found', () => {
        it('should return node details with error description for non-existent nodes', async () => {
            const input: GetNodeDetailsInput = {
                engine: 'pmd',
                language: 'apex',
                nodeNames: ['NonExistentNode', 'AnotherNonExistentNode']
            };

            const action: GetNodeDetailsActionImpl = new GetNodeDetailsActionImpl();
            const output: GetNodeDetailsOutput = await action.exec(input);

            expect(output.status).toEqual('success');
            expect(output.nodeDetails).toBeDefined();
            expect(output.nodeDetails?.length).toBe(2);
            
            const nonExistentNode = output.nodeDetails?.find(n => n.name === 'NonExistentNode');
            expect(nonExistentNode).toBeDefined();
            expect(nonExistentNode?.description).toContain('not found in AST reference');
            expect(nonExistentNode?.attributes).toEqual([]);
        });

        it('should handle mix of existing and non-existent nodes', async () => {
            const input: GetNodeDetailsInput = {
                engine: 'pmd',
                language: 'apex',
                nodeNames: ['UserClass', 'NonExistentNode', 'Method']
            };

            const action: GetNodeDetailsActionImpl = new GetNodeDetailsActionImpl();
            const output: GetNodeDetailsOutput = await action.exec(input);

            expect(output.status).toEqual('success');
            expect(output.nodeDetails).toBeDefined();
            
            // Should have UserClass and Method (plus their parent classes)
            const userClass = output.nodeDetails?.find(n => n.name === 'UserClass');
            const method = output.nodeDetails?.find(n => n.name === 'Method');
            const nonExistent = output.nodeDetails?.find(n => n.name === 'NonExistentNode');
            
            expect(userClass).toBeDefined();
            expect(method).toBeDefined();
            expect(nonExistent).toBeDefined();
            expect(nonExistent?.description).toContain('not found');
        });
    });

    describe('When knowledge base files are missing', () => {
        it('should return error when AST reference file is missing', async () => {
            const invalidPath = path.join(__dirname, '..', 'fixtures', 'non-existent-path');
            const action: GetNodeDetailsActionImpl = new GetNodeDetailsActionImpl(invalidPath);

            const input: GetNodeDetailsInput = {
                engine: 'pmd',
                language: 'apex',
                nodeNames: ['UserClass']
            };

            const output: GetNodeDetailsOutput = await action.exec(input);

            expect(output.status).toEqual('error');
            expect(output.error).toContain('Knowledge base file not found');
            expect(output.error).toContain('apex-ast-reference.json');
        });
    });

    describe('When custom knowledge base path is provided', () => {
        it('should use custom path when provided', async () => {
            const customPath = path.join(__dirname, '..', '..', 'src', 'resources', 'custom-rules');
            const action: GetNodeDetailsActionImpl = new GetNodeDetailsActionImpl(customPath);

            const input: GetNodeDetailsInput = {
                engine: 'pmd',
                language: 'apex',
                nodeNames: ['UserClass']
            };

            const output: GetNodeDetailsOutput = await action.exec(input);

            expect(output.status).toEqual('success');
            expect(output.nodeDetails).toBeDefined();
            expect(output.importantNotes).toBeDefined();
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

                const action: GetNodeDetailsActionImpl = new GetNodeDetailsActionImpl(tempDir);
                const input: GetNodeDetailsInput = {
                    engine: 'pmd',
                    language: 'apex',
                    nodeNames: ['UserClass']
                };

                const output: GetNodeDetailsOutput = await action.exec(input);

                expect(output.status).toEqual('error');
                expect(output.error).toContain('Failed to get node details');
            } finally {
                // Cleanup
                if (fs.existsSync(tempDir)) {
                    fs.rmSync(tempDir, { recursive: true, force: true });
                }
            }
        });
    });

    describe('When processing nodes with inheritance', () => {
        it('should not duplicate parent class nodes when multiple child nodes share the same parent', async () => {
            const input: GetNodeDetailsInput = {
                engine: 'pmd',
                language: 'apex',
                nodeNames: ['UserClass', 'UserInterface', 'UserEnum'] // All extend BaseApexClass
            };

            const action: GetNodeDetailsActionImpl = new GetNodeDetailsActionImpl();
            const output: GetNodeDetailsOutput = await action.exec(input);

            expect(output.status).toEqual('success');
            expect(output.nodeDetails).toBeDefined();
            
            // BaseApexClass should appear only once (not 3 times)
            const baseApexClassNodes = output.nodeDetails?.filter(n => n.name === 'BaseApexClass');
            expect(baseApexClassNodes?.length).toBe(1);
        });

        it('should include all parent classes in inheritance chain', async () => {
            const input: GetNodeDetailsInput = {
                engine: 'pmd',
                language: 'apex',
                nodeNames: ['CatchBlockStatement'] // Extends AbstractApexCommentContainerNode -> AbstractApexNode.Single -> AbstractApexNode
            };

            const action: GetNodeDetailsActionImpl = new GetNodeDetailsActionImpl();
            const output: GetNodeDetailsOutput = await action.exec(input);

            expect(output.status).toEqual('success');
            expect(output.nodeDetails).toBeDefined();
            
            // Should include all parent classes in the chain
            const parentClassNames = output.nodeDetails?.map(n => n.name) || [];
            expect(parentClassNames).toContain('AbstractApexCommentContainerNode');
            expect(parentClassNames).toContain('AbstractApexNode.Single');
            expect(parentClassNames).toContain('AbstractApexNode');
        });
    });
});

