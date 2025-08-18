import { describe, beforeEach, test, expect } from '@jest/globals';
import { renderHistorial } from '../ui.js';

// Ensure card and datáfono incomes are shown in historial

describe('renderHistorial card totals', () => {
    let historialTable;
    let resumenTable;
    let resumenTotals;
    let store;

    beforeEach(() => {
        store = {};
        global.localStorage = {
            getItem: (key) => store[key] || null,
            setItem: (key, value) => { store[key] = value; },
            removeItem: (key) => { delete store[key]; }
        };
        // Set up index and a day with card data
        store['caja:index'] = JSON.stringify(['2024-01-01#1']);
        store['caja:2024-01-01#1'] = JSON.stringify({
            fecha: '2024-01-01',
            sucursal: 'Test',
            apertura: 0,
            ingresos: 0,
            ingresosTarjetaExora: 100,
            ingresosTarjetaDatafono: 80,
            movimientos: [],
            cierre: 0
        });
        historialTable = { innerHTML: '' };
        resumenTable = { innerHTML: '' };
        resumenTotals = { innerHTML: '' };
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
            }
        };
    });

    test('shows card incomes and difference', () => {
        renderHistorial();
        expect(historialTable.innerHTML).toContain('100,00 €');
        expect(historialTable.innerHTML).toContain('80,00 €');
        expect(historialTable.innerHTML).toContain('20,00 €');
    });
});

