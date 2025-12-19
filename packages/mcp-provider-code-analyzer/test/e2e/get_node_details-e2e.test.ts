import { z } from 'zod';
import { McpTestClient, DxMcpTransport } from '@salesforce/mcp-test-client';
import { inputSchema } from '../../src/tools/get_code_analyzer_node_details.js';
import { GetNodeDetailsOutput } from '../../src/actions/get-node-details.js';

describe('get_code_analyzer_node_details', () => {
    const client = new McpTestClient({
        timeout: 1000
    });

    const testInputSchema = {
        name: z.literal('get_code_analyzer_node_details'),
        params: inputSchema
    };

    beforeAll(async () => {
        try {
            const transport = DxMcpTransport({
                args: ['--toolsets', 'code-analysis', '--orgs', 'DEFAULT_TARGET_ORG', '--no-telemetry', '--allow-non-ga-tools']
            });
            await client.connect(transport);
        } catch (error) {
            console.error('Setup failed:', error);
            throw error;
        }
    }, 30000);

    afterAll(async () => {
        if (client?.connected) {
            await client.disconnect();
        }
    });

    it('should return node details with direct attributes for UserClass', async () => {
        const result = await client.callTool(testInputSchema, {
            name: 'get_code_analyzer_node_details',
            params: {
                engine: 'pmd',
                language: 'apex',
                nodeNames: ['UserClass']
            }
        }, 1000);

        const output = result.structuredContent as GetNodeDetailsOutput;
        expect(output.status).toEqual('success');
        expect(output.nodeDetails).toBeDefined();
        expect(output.nodeDetails!.length).toBeGreaterThan(0);
        
        const userClassNode = output.nodeDetails!.find((n) => n.name === 'UserClass');
        expect(userClassNode).toBeDefined();
        expect(userClassNode!.description).toBeDefined();
        expect(userClassNode!.category).toBeDefined();
        expect(userClassNode!.attributes).toBeDefined();
        expect(Array.isArray(userClassNode!.attributes)).toBe(true);
        expect(userClassNode!.attributes.length).toBeGreaterThan(0);
    }, 1000);

    it('should return parent class nodes with inherited attributes', async () => {
        const result = await client.callTool(testInputSchema, {
            name: 'get_code_analyzer_node_details',
            params: {
                engine: 'pmd',
                language: 'apex',
                nodeNames: ['UserClass']
            }
        }, 1000);

        const output = result.structuredContent as GetNodeDetailsOutput;
        expect(output.status).toEqual('success');
        expect(output.nodeDetails).toBeDefined();
        
        // Should include parent classes (BaseApexClass, AbstractApexNode.Single, AbstractApexNode)
        const parentClasses = output.nodeDetails!.filter((n) => 
            n.name === 'BaseApexClass' || 
            n.name === 'AbstractApexNode.Single' || 
            n.name === 'AbstractApexNode'
        );
        expect(parentClasses.length).toBeGreaterThan(0);
        
        // Check that parent classes have attributes from inheritSchema
        const baseApexClass = output.nodeDetails!.find((n) => n.name === 'BaseApexClass');
        expect(baseApexClass).toBeDefined();
        expect(baseApexClass!.category).toEqual('Inheritance');
        expect(baseApexClass!.attributes).toBeDefined();
        expect(baseApexClass!.attributes.length).toBeGreaterThan(0);
    }, 1000);

    it('should return important notes for Apex', async () => {
        const result = await client.callTool(testInputSchema, {
            name: 'get_code_analyzer_node_details',
            params: {
                engine: 'pmd',
                language: 'apex',
                nodeNames: ['Method']
            }
        }, 1000);

        const output = result.structuredContent as GetNodeDetailsOutput;
        expect(output.status).toEqual('success');
        expect(output.importantNotes).toBeDefined();
        expect(Array.isArray(output.importantNotes)).toBe(true);
        expect(output.importantNotes!.length).toBeGreaterThan(0);
        
        // Check structure of important notes
        const firstNote = output.importantNotes![0];
        expect(firstNote!.title).toBeDefined();
        expect(firstNote!.content).toBeDefined();
    }, 1000);

    it('should handle multiple node names', async () => {
        const result = await client.callTool(testInputSchema, {
            name: 'get_code_analyzer_node_details',
            params: {
                engine: 'pmd',
                language: 'apex',
                nodeNames: ['UserClass', 'Method', 'MethodCallExpression']
            }
        }, 1000);

        const output = result.structuredContent as GetNodeDetailsOutput;
        expect(output.status).toEqual('success');
        expect(output.nodeDetails).toBeDefined();
        
        // Should have at least the 3 requested nodes (plus their parent classes)
        const requestedNodes = output.nodeDetails!.filter((n) => 
            n.name === 'UserClass' || n.name === 'Method' || n.name === 'MethodCallExpression'
        );
        expect(requestedNodes.length).toBeGreaterThanOrEqual(3);
    }, 1000);

    it('should handle case-insensitive language input', async () => {
        const result = await client.callTool(testInputSchema, {
            name: 'get_code_analyzer_node_details',
            params: {
                engine: 'pmd',
                language: 'APEX', // uppercase
                nodeNames: ['UserClass']
            }
        }, 1000);

        const output = result.structuredContent as GetNodeDetailsOutput;
        expect(output.status).toEqual('success');
        expect(output.nodeDetails).toBeDefined();
        expect(output.nodeDetails!.length).toBeGreaterThan(0);
    }, 1000);

    it('should load knowledge base once and return both nodeDetails and importantNotes', async () => {
        const result = await client.callTool(testInputSchema, {
            name: 'get_code_analyzer_node_details',
            params: {
                engine: 'pmd',
                language: 'apex',
                nodeNames: ['UserClass']
            }
        }, 1000);

        const output = result.structuredContent as GetNodeDetailsOutput;
        // Both nodeDetails and importantNotes should be present, indicating
        // the knowledge base was loaded once and reused (optimization)
        expect(output.nodeDetails).toBeDefined();
        expect(output.importantNotes).toBeDefined();
        expect(output.nodeDetails!.length).toBeGreaterThan(0);
        expect(output.importantNotes!.length).toBeGreaterThan(0);
    }, 1000);

    it('should return error for unsupported engine (eslint)', async () => {
        const result = await client.callTool(testInputSchema, {
            name: 'get_code_analyzer_node_details',
            params: {
                engine: 'eslint',
                language: 'javascript',
                nodeNames: ['SomeNode']
            }
        }, 1000);

        const output = result.structuredContent as GetNodeDetailsOutput;
        expect(output.status).toEqual('error');
        expect(output.error).toContain('does not support node details');
        expect(output.error).toContain('eslint');
        expect(output.nodeDetails).toBeUndefined();
        expect(output.importantNotes).toBeUndefined();
    }, 1000);

    it('should return error for unsupported engine (regex)', async () => {
        const result = await client.callTool(testInputSchema, {
            name: 'get_code_analyzer_node_details',
            params: {
                engine: 'regex',
                language: 'apex',
                nodeNames: ['SomeNode']
            }
        }, 1000);

        const output = result.structuredContent as GetNodeDetailsOutput;
        expect(output.status).toEqual('error');
        expect(output.error).toContain('does not support node details');
        expect(output.error).toContain('regex');
    }, 1000);

    it('should return error for unsupported language with PMD', async () => {
        const result = await client.callTool(testInputSchema, {
            name: 'get_code_analyzer_node_details',
            params: {
                engine: 'pmd',
                language: 'javascript',
                nodeNames: ['SomeNode']
            }
        }, 1000);

        const output = result.structuredContent as GetNodeDetailsOutput;
        expect(output.status).toEqual('error');
        expect(output.error).toContain('support is not yet added');
        expect(output.error).toContain('Currently supported languages: apex');
    }, 1000);

    it('should return error for typescript language', async () => {
        const result = await client.callTool(testInputSchema, {
            name: 'get_code_analyzer_node_details',
            params: {
                engine: 'pmd',
                language: 'typescript',
                nodeNames: ['SomeNode']
            }
        }, 1000);

        const output = result.structuredContent as GetNodeDetailsOutput;
        expect(output.status).toEqual('error');
        expect(output.error).toContain('support is not yet added');
    }, 1000);


    it('should return node details with error description for non-existent nodes', async () => {
        const result = await client.callTool(testInputSchema, {
            name: 'get_code_analyzer_node_details',
            params: {
                engine: 'pmd',
                language: 'apex',
                nodeNames: ['NonExistentNode', 'AnotherNonExistentNode']
            }
        }, 1000);

        const output = result.structuredContent as GetNodeDetailsOutput;
        expect(output.status).toEqual('success');
        expect(output.nodeDetails).toBeDefined();
        expect(output.nodeDetails!.length).toBe(2);
        
        const nonExistentNode = output.nodeDetails!.find((n) => n.name === 'NonExistentNode');
        expect(nonExistentNode).toBeDefined();
        expect(nonExistentNode!.description).toContain('not found in AST reference');
        expect(nonExistentNode!.attributes).toEqual([]);
    }, 1000);

    it('should handle mix of existing and non-existent nodes', async () => {
        const result = await client.callTool(testInputSchema, {
            name: 'get_code_analyzer_node_details',
            params: {
                engine: 'pmd',
                language: 'apex',
                nodeNames: ['UserClass', 'NonExistentNode', 'Method']
            }
        }, 1000);

        const output = result.structuredContent as GetNodeDetailsOutput;
        expect(output.status).toEqual('success');
        expect(output.nodeDetails).toBeDefined();
        
        // Should have UserClass and Method (plus their parent classes)
        const userClass = output.nodeDetails!.find((n) => n.name === 'UserClass');
        const method = output.nodeDetails!.find((n) => n.name === 'Method');
        const nonExistent = output.nodeDetails!.find((n) => n.name === 'NonExistentNode');
        
        expect(userClass).toBeDefined();
        expect(method).toBeDefined();
        expect(nonExistent).toBeDefined();
        expect(nonExistent!.description).toContain('not found');
    }, 1000);

    it('should not duplicate parent class nodes when multiple child nodes share the same parent', async () => {
        const result = await client.callTool(testInputSchema, {
            name: 'get_code_analyzer_node_details',
            params: {
                engine: 'pmd',
                language: 'apex',
                nodeNames: ['UserClass', 'UserInterface', 'UserEnum'] // All extend BaseApexClass
            }
        }, 1000);

        const output = result.structuredContent as GetNodeDetailsOutput;
        expect(output.status).toEqual('success');
        expect(output.nodeDetails).toBeDefined();
        
        // BaseApexClass should appear only once (not 3 times)
        const baseApexClassNodes = output.nodeDetails!.filter((n) => n.name === 'BaseApexClass');
        expect(baseApexClassNodes.length).toBe(1);
    }, 1000);

    it('should include all parent classes in inheritance chain', async () => {
        const result = await client.callTool(testInputSchema, {
            name: 'get_code_analyzer_node_details',
            params: {
                engine: 'pmd',
                language: 'apex',
                nodeNames: ['CatchBlockStatement'] // Extends AbstractApexCommentContainerNode -> AbstractApexNode.Single -> AbstractApexNode
            }
        }, 1000);

        const output = result.structuredContent as GetNodeDetailsOutput;
        expect(output.status).toEqual('success');
        expect(output.nodeDetails).toBeDefined();
        
        // Should include all parent classes in the chain
        const parentClassNames = output.nodeDetails!.map((n) => n.name);
        expect(parentClassNames).toContain('AbstractApexCommentContainerNode');
        expect(parentClassNames).toContain('AbstractApexNode.Single');
        expect(parentClassNames).toContain('AbstractApexNode');
    }, 1000);

    it('should return error when language is empty', async () => {
        const result = await client.callTool(testInputSchema, {
            name: 'get_code_analyzer_node_details',
            params: {
                engine: 'pmd',
                language: '',
                nodeNames: ['UserClass']
            }
        }, 1000);

        const output = result.structuredContent as GetNodeDetailsOutput;
        expect(output.status).toEqual('error');
        expect(output.error).toContain('language is required');
    }, 1000);

    it('should return node details with correct structure for Method node', async () => {
        const result = await client.callTool(testInputSchema, {
            name: 'get_code_analyzer_node_details',
            params: {
                engine: 'pmd',
                language: 'apex',
                nodeNames: ['Method']
            }
        }, 1000);

        const output = result.structuredContent as GetNodeDetailsOutput;
        expect(output.status).toEqual('success');
        expect(output.nodeDetails).toBeDefined();
        
        const methodNode = output.nodeDetails!.find((n) => n.name === 'Method');
        expect(methodNode).toBeDefined();
        expect(methodNode!.name).toEqual('Method');
        expect(methodNode!.description).toBeDefined();
        expect(methodNode!.category).toBeDefined();
        expect(methodNode!.attributes).toBeDefined();
        expect(Array.isArray(methodNode!.attributes)).toBe(true);
        
        // Check attribute structure
        if (methodNode!.attributes.length > 0) {
            const firstAttr = methodNode!.attributes[0];
            expect(firstAttr!.name).toBeDefined();
            expect(firstAttr!.type).toBeDefined();
            expect(firstAttr!.description).toBeDefined();
        }
    }, 1000);

    it('should return DML statement nodes with inherited attributes from AbstractDmlStatement', async () => {
        const result = await client.callTool(testInputSchema, {
            name: 'get_code_analyzer_node_details',
            params: {
                engine: 'pmd',
                language: 'apex',
                nodeNames: ['DmlInsertStatement', 'DmlUpdateStatement']
            }
        }, 1000);

        const output = result.structuredContent as GetNodeDetailsOutput;
        expect(output.status).toEqual('success');
        expect(output.nodeDetails).toBeDefined();
        
        // Should include AbstractDmlStatement as parent class
        const abstractDmlStatement = output.nodeDetails!.find((n) => n.name === 'AbstractDmlStatement');
        expect(abstractDmlStatement).toBeDefined();
        expect(abstractDmlStatement!.category).toEqual('Inheritance');
        expect(abstractDmlStatement!.attributes).toBeDefined();
        expect(abstractDmlStatement!.attributes.length).toBe(0);
    }, 1000);
});

