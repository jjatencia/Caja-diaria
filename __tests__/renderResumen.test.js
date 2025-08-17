import { describe, beforeEach, test, expect } from '@jest/globals';
import { renderHistorial } from '../ui.js';

// This test ensures that deleting the last saved day updates the billing summary
// by calling renderResumen even when there are no entries left.
describe('renderResumen on empty historial', () => {
    let historialTable;
    let resumenTable;
    let resumenTotals;

    beforeEach(() => {
        historialTable = { innerHTML: '' };
        resumenTable = { innerHTML: 'prev' };
        resumenTotals = { innerHTML: 'prevTotals' };

        global.document = {
            getElementById: (id) => {
                switch (id) {
                    case 'historialTable':
                        return historialTable;
                    case 'resumenTable':
                        return resumenTable;
                    case 'resumenTotals':
                        return resumenTotals;
                    default:
                        return null;
                }
            },
        };

        global.localStorage = {
            getItem: () => null,
            setItem: () => {},
            removeItem: () => {},
        };
    });

    test('summary reflects empty data', () => {
        renderHistorial();
        expect(resumenTable.innerHTML).toContain('No hay datos');
        expect(resumenTotals.innerHTML).toBe('');
    });
});

