import { describe, it, expect } from 'vitest';
import { CreateCustomPmdRuleMcpTool } from '../../src/tools/create_custom_pmd_rule.js';

describe('CreateCustomPmdRuleMcpTool', () => {
    it('should generate knowledge base from sample files', async () => {
        const tool = new CreateCustomPmdRuleMcpTool();
        
        const result = await tool.execute({
            userPrompt: 'Ban System.debug calls',
            currentDirectory: '/Users/emy.paulson/Documents/cursorMCPTools/agentforce-project-1',
            sampleFiles: [
                '/Users/emy.paulson/Documents/cursorMCPTools/agentforce-project-1/force-app/main/default/classes/AccountProcessor.cls'
            ]
        });
        
        console.log('Result:', JSON.stringify(result, null, 2));
        
        expect(result.status).toBe('ready_for_xpath_generation');
        expect(result.projectRoot).toBeTruthy();
        expect(result.knowledgeBase).toBeDefined();
    });

    it('should find project root from nested directory', async () => {
        const tool = new CreateCustomPmdRuleMcpTool();
        
        const result = await tool.execute({
            userPrompt: 'Test prompt',
            currentDirectory: '/Users/emy.paulson/Documents/cursorMCPTools/agentforce-project-1/force-app/main/default/classes'
        });
        
        expect(result.projectRoot).toBe('/Users/emy.paulson/Documents/cursorMCPTools/agentforce-project-1');
    });
});

