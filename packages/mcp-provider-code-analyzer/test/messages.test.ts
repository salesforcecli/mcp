import { getMessage } from "../src/messages.js";

describe("#getMessage()", () => {
    it('When arguments are correctly passed in, they get filled in as they should', () => {
        expect(getMessage('tooManyTargets', 1, 3)).toEqual('The number of targets, 1, exceeds the maximum allowable length of 3.');
    });

    it('When too few variables are passed in, then throw an error', () => {
        expect(() => getMessage('tooManyTargets', 1)).toThrow(
            `Incorrect number of variables supplied to the message 'tooManyTargets' in the message catalog.\n` +
            `Expected amount: 2. Actual amount: 1.`
        );
    });

    it('When too many variables are passed in then throw error', () => {
        expect(() => getMessage('tooManyTargets', 2, 5, 2)).toThrow(
            `Incorrect number of variables supplied to the message 'tooManyTargets' in the message catalog.\n` +
            `Expected amount: 2. Actual amount: 3.`
        );
    });

    it('When message id does not exist in the catalog then throw error', () => {
        expect(() => getMessage('doesNotExist')).toThrow(
            `Message with id "doesNotExist" does not exist in the message catalog.`
        );
    });
})