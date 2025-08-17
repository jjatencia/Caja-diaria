import { describe, expect, test } from '@jest/globals';
import { parseNum } from '../utils/parseNum.js';
import { computeTotals } from '../utils/computeTotals.js';


describe('parseNum', () => {
    test('handles numbers directly', () => {
        expect(parseNum(5)).toBe(5);
    });

    test('parses formatted strings', () => {
        expect(parseNum('1.234,56')).toBeCloseTo(1234.56);
    });

    test('returns 0 for invalid input', () => {
        expect(parseNum('abc')).toBe(0);
    });
});


describe('computeTotals', () => {
    test('computes totals from movimientos', () => {
        const movimientos = [
            { tipo: 'entrada', importe: 10 },
            { tipo: 'salida', importe: 5 },
            { tipo: 'entrada', importe: 2 }
        ];
        const result = computeTotals(100, 50, movimientos, 120);
        expect(result).toEqual({ entradas: 12, salidas: 5, total: 157, diff: 37 });
    });

    test('handles string numbers and empty movimientos', () => {
        const result = computeTotals('1.000,00', '200,00', [], '800');
        expect(result).toEqual({ entradas: 0, salidas: 0, total: 1200, diff: 400 });
    });
});
