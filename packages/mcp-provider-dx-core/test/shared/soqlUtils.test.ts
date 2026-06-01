import { expect } from 'chai';
import {
    escapeSoqlString,
    containsSqlInjectionPatterns,
    isValidUsername,
    validateAndEscapeUsername
} from '../../src/shared/soqlUtils.js';

describe('soqlUtils', () => {
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

    describe('containsSqlInjectionPatterns', () => {
        it('should detect SQL injection patterns', () => {
            expect(containsSqlInjectionPatterns("' OR '1'='1")).to.be.true;
            expect(containsSqlInjectionPatterns("'; DROP TABLE--")).to.be.true;
            expect(containsSqlInjectionPatterns("test UNION SELECT")).to.be.true;
            expect(containsSqlInjectionPatterns("value--comment")).to.be.true;
            expect(containsSqlInjectionPatterns("item; DELETE FROM")).to.be.true;
        });

        it('should allow safe strings', () => {
            expect(containsSqlInjectionPatterns("user@example.com")).to.be.false;
            expect(containsSqlInjectionPatterns("admin@test.org")).to.be.false;
            expect(containsSqlInjectionPatterns("test.user@company.com")).to.be.false;
        });

        it('should handle non-string values', () => {
            expect(containsSqlInjectionPatterns(null as any)).to.be.true;
            expect(containsSqlInjectionPatterns(undefined as any)).to.be.true;
            expect(containsSqlInjectionPatterns(123 as any)).to.be.true;
        });
    });

    describe('isValidUsername', () => {
        it('should accept valid email-like usernames', () => {
            expect(isValidUsername('user@example.com')).to.be.true;
            expect(isValidUsername('test.user@company.org')).to.be.true;
            expect(isValidUsername('admin+test@domain.co.uk')).to.be.true;
            expect(isValidUsername('user_name@sub.domain.com')).to.be.true;
        });

        it('should reject usernames without @', () => {
            expect(isValidUsername('username')).to.be.false;
            expect(isValidUsername('admin')).to.be.false;
        });

        it('should reject invalid email formats', () => {
            expect(isValidUsername('@example.com')).to.be.false;
            expect(isValidUsername('user@')).to.be.false;
            expect(isValidUsername('user@domain')).to.be.false;
            expect(isValidUsername('user@@domain.com')).to.be.false;
        });

        it('should reject SQL injection attempts', () => {
            expect(isValidUsername("user@example.com' OR 1=1--")).to.be.false;
            expect(isValidUsername("x@example.com' OR IsActive = true OR Username='x")).to.be.false;
            expect(isValidUsername("admin@test.com; DROP TABLE")).to.be.false;
            expect(isValidUsername("user@domain.com' UNION SELECT")).to.be.false;
        });

        it('should reject non-string values', () => {
            expect(isValidUsername(null as any)).to.be.false;
            expect(isValidUsername(undefined as any)).to.be.false;
            expect(isValidUsername(123 as any)).to.be.false;
        });
    });

    describe('validateAndEscapeUsername', () => {
        it('should return escaped valid usernames', () => {
            expect(validateAndEscapeUsername('user@example.com')).to.equal('user@example.com');
            expect(validateAndEscapeUsername(' admin@test.org ')).to.equal('admin@test.org');
            expect(validateAndEscapeUsername('test.user@company.com')).to.equal('test.user@company.com');
        });

        it('should escape single quotes in valid usernames', () => {
            expect(validateAndEscapeUsername("o'brien@example.com")).to.equal("o\\'brien@example.com");
        });

        it('should throw on invalid usernames', () => {
            expect(() => validateAndEscapeUsername('invalid')).to.throw(/Invalid username format/);
            expect(() => validateAndEscapeUsername('user@')).to.throw(/Invalid username format/);
            expect(() => validateAndEscapeUsername('@domain.com')).to.throw(/Invalid username format/);
        });

        it('should throw on SQL injection attempts', () => {
            expect(() => validateAndEscapeUsername("user@example.com' OR 1=1--")).to.throw(/SQL injection/);
            expect(() => validateAndEscapeUsername("x@example.com' OR IsActive = true OR Username='x")).to.throw(/SQL injection/);
            expect(() => validateAndEscapeUsername("admin@test.com; DROP TABLE")).to.throw(/SQL injection/);
        });

        it('should reject the proof of concept from the bug report', () => {
            const pocUsername = "x@example.com' OR IsActive = true OR Username='x";
            expect(() => validateAndEscapeUsername(pocUsername)).to.throw(/SQL injection/);
        });
    });

    describe('Security - Prevent injection from bug W-22550508', () => {
        it('should block the exact proof of concept attack', () => {
            // From the bug report:
            // "onBehalfOf": "x@example.com' OR IsActive = true OR Username='x"
            const attackUsername = "x@example.com' OR IsActive = true OR Username='x";

            // Should be detected as invalid
            expect(isValidUsername(attackUsername)).to.be.false;

            // Should throw when trying to validate
            expect(() => validateAndEscapeUsername(attackUsername)).to.throw();
        });

        it('should allow legitimate usernames', () => {
            const legitimateUsernames = [
                'authorized-org-admin@example.com',
                'test-user@company.org',
                'admin+alias@domain.co.uk'
            ];

            legitimateUsernames.forEach(username => {
                expect(isValidUsername(username), `Should accept: ${username}`).to.be.true;
                expect(() => validateAndEscapeUsername(username)).to.not.throw();
            });
        });

        it('should prevent predicate modification via various injection techniques', () => {
            const injectionAttempts = [
                "user@test.com' OR 1=1--",
                "admin@test.com'; DROP TABLE Users--",
                "user@test.com' UNION SELECT * FROM User--",
                "test@example.com' AND '1'='1",
                "user@test.com' OR IsActive=true--"
            ];

            injectionAttempts.forEach(attempt => {
                expect(() => validateAndEscapeUsername(attempt), `Should reject: ${attempt}`).to.throw();
            });
        });
    });
});
