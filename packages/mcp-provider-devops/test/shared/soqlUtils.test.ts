import { expect } from 'chai';
import {
    isValidSalesforceId,
    escapeSoqlString,
    validateSalesforceId,
    isValidWorkItemName,
    validateWorkItemName
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

        it('should throw on invalid work item names', () => {
            expect(() => validateWorkItemName('invalid')).to.throw(/Invalid work item name format/);
            expect(() => validateWorkItemName("WI-0001' OR 1=1--")).to.throw(/Invalid work item name format/);
        });
    });

    describe('SQL injection prevention', () => {
        it('should prevent common injection patterns', () => {
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
                expect(isValidWorkItemName(attempt), `Should reject: ${attempt}`).to.be.false;
            });
        });
    });
});
