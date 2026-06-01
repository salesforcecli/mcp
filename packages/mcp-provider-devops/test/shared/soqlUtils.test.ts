import { expect } from 'chai';
import {
    isValidSalesforceId,
    escapeSoqlString,
    validateSalesforceId,
    isValidWorkItemName,
    validateWorkItemName,
    containsSqlInjectionPatterns
} from '../../src/shared/soqlUtils.js';

describe('soqlUtils', () => {
    describe('isValidSalesforceId', () => {
        it('should accept valid 15-character Salesforce IDs', () => {
            expect(isValidSalesforceId('001xx000003DGb2')).to.be.true;
            expect(isValidSalesforceId('a07EE00002aJTv0')).to.be.true;
        });

        it('should accept valid 18-character Salesforce IDs', () => {
            expect(isValidSalesforceId('001xx000003DGb2AAG')).to.be.true;
            expect(isValidSalesforceId('a07EE00002aJTv0YAG')).to.be.true;
        });

        it('should reject IDs with invalid length', () => {
            expect(isValidSalesforceId('123')).to.be.false;
            expect(isValidSalesforceId('001xx000003DGb2AAGEXTRA')).to.be.false;
        });

        it('should reject IDs with SQL injection attempts', () => {
            expect(isValidSalesforceId("001' OR 1=1--")).to.be.false;
            expect(isValidSalesforceId("'; DROP TABLE--")).to.be.false;
        });

        it('should reject non-string values', () => {
            expect(isValidSalesforceId(null as any)).to.be.false;
            expect(isValidSalesforceId(undefined as any)).to.be.false;
            expect(isValidSalesforceId(123 as any)).to.be.false;
        });
    });

    describe('escapeSoqlString', () => {
        it('should escape single quotes', () => {
            expect(escapeSoqlString("O'Brien")).to.equal("O\\'Brien");
            expect(escapeSoqlString("It's working")).to.equal("It\\'s working");
        });

        it('should handle strings without quotes', () => {
            expect(escapeSoqlString("normal text")).to.equal("normal text");
        });

        it('should handle empty strings', () => {
            expect(escapeSoqlString("")).to.equal("");
        });

        it('should throw on non-string values', () => {
            expect(() => escapeSoqlString(null as any)).to.throw();
            expect(() => escapeSoqlString(123 as any)).to.throw();
        });
    });

    describe('validateSalesforceId', () => {
        it('should return trimmed valid IDs', () => {
            expect(validateSalesforceId('001xx000003DGb2')).to.equal('001xx000003DGb2');
            expect(validateSalesforceId(' a07EE00002aJTv0 ')).to.equal('a07EE00002aJTv0');
        });

        it('should throw on invalid IDs', () => {
            expect(() => validateSalesforceId('invalid')).to.throw(/Invalid Salesforce ID/);
            expect(() => validateSalesforceId("001' OR 1=1--")).to.throw(/Invalid Salesforce ID/);
        });

        it('should include field name in error message', () => {
            try {
                validateSalesforceId('invalid', 'projectId');
                expect.fail('Should have thrown');
            } catch (error: any) {
                expect(error.message).to.include('projectId');
            }
        });
    });

    describe('isValidWorkItemName', () => {
        it('should accept valid work item names', () => {
            expect(isValidWorkItemName('WI-12345')).to.be.true;
            expect(isValidWorkItemName('WI-0001')).to.be.true;
            expect(isValidWorkItemName('WI-9999999')).to.be.true;
        });

        it('should reject invalid formats', () => {
            expect(isValidWorkItemName('W-12345')).to.be.false;
            expect(isValidWorkItemName('WI12345')).to.be.false;
            expect(isValidWorkItemName('WI-')).to.be.false;
            expect(isValidWorkItemName('WI-ABC')).to.be.false;
        });

        it('should reject SQL injection attempts', () => {
            expect(isValidWorkItemName("WI-0001' OR Name != 'x")).to.be.false;
            expect(isValidWorkItemName("'; DROP TABLE--")).to.be.false;
        });

        it('should reject non-string values', () => {
            expect(isValidWorkItemName(null as any)).to.be.false;
            expect(isValidWorkItemName(undefined as any)).to.be.false;
        });
    });

    describe('validateWorkItemName', () => {
        it('should return escaped valid work item names', () => {
            expect(validateWorkItemName('WI-12345')).to.equal('WI-12345');
            expect(validateWorkItemName(' WI-0001 ')).to.equal('WI-0001');
        });

        it('should allow alphanumeric work item names for managed packages', () => {
            expect(validateWorkItemName('Test Work Item')).to.equal('Test Work Item');
            expect(validateWorkItemName('My_Work_Item-123')).to.equal('My_Work_Item-123');
            expect(validateWorkItemName('Feature 2024')).to.equal('Feature 2024');
        });

        it('should escape single quotes in work item names', () => {
            expect(validateWorkItemName("O'Brien Task")).to.equal("O\\'Brien Task");
        });

        it('should throw on SQL injection attempts', () => {
            expect(() => validateWorkItemName("WI-0001' OR 1=1--")).to.throw(/SQL injection/);
            expect(() => validateWorkItemName("Test'; DROP TABLE--")).to.throw(/SQL injection/);
            expect(() => validateWorkItemName("WI-001 UNION SELECT")).to.throw(/SQL injection/);
            expect(() => validateWorkItemName("Task OR Name != 'x'")).to.throw(/SQL injection/);
        });

        it('should throw on special characters that could be dangerous', () => {
            expect(() => validateWorkItemName('Task<script>')).to.throw(/Invalid work item name format/);
            expect(() => validateWorkItemName('Task;DROP;')).to.throw(/SQL injection/);
        });
    });

    describe('containsSqlInjectionPatterns', () => {
        it('should detect SQL injection patterns', () => {
            expect(containsSqlInjectionPatterns("' OR '1'='1")).to.be.true;
            expect(containsSqlInjectionPatterns("'; DROP TABLE--")).to.be.true;
            expect(containsSqlInjectionPatterns("test UNION SELECT")).to.be.true;
            expect(containsSqlInjectionPatterns("value--comment")).to.be.true;
            expect(containsSqlInjectionPatterns("item; DELETE FROM")).to.be.true;
        });

        it('should allow safe strings', () => {
            expect(containsSqlInjectionPatterns("WI-12345")).to.be.false;
            expect(containsSqlInjectionPatterns("Test Work Item")).to.be.false;
            expect(containsSqlInjectionPatterns("Feature_123")).to.be.false;
        });

        it('should handle single quotes that will be escaped', () => {
            // Single quotes alone are not blocked since we escape them
            expect(containsSqlInjectionPatterns("O'Brien")).to.be.false;
            // But quotes with injection keywords should be blocked
            expect(containsSqlInjectionPatterns("O'Brien' OR 1=1")).to.be.true;
        });
    });

    describe('SQL injection prevention', () => {
        it('should prevent common injection patterns in Salesforce IDs', () => {
            const injectionAttempts = [
                "' OR '1'='1",
                "'; DROP TABLE WorkItem--",
                "' UNION SELECT * FROM User--",
                "' OR 1=1--",
                "admin'--",
                "' OR 'x'='x"
            ];

            injectionAttempts.forEach(attempt => {
                expect(isValidSalesforceId(attempt), `Should reject: ${attempt}`).to.be.false;
            });
        });

        it('should prevent injection patterns in work item names via validateWorkItemName', () => {
            const injectionAttempts = [
                "' OR '1'='1",
                "'; DROP TABLE WorkItem--",
                "' UNION SELECT * FROM User--",
                "' OR 1=1--",
                "test' OR 'x'='x"
            ];

            injectionAttempts.forEach(attempt => {
                expect(() => validateWorkItemName(attempt), `Should reject: ${attempt}`).to.throw();
            });
        });
    });
});
