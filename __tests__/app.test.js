import { describe, beforeEach, test, expect, jest } from '@jest/globals';

// Mock UI module
jest.unstable_mockModule('../ui.js', () => ({
    renderMovimientos: jest.fn(),
    renderHistorial: jest.fn(),
    showAlert: jest.fn(),
    displayTestResults: jest.fn(),
    hideTests: jest.fn()
}));

// Mock utils module
jest.unstable_mockModule('../utils/index.js', () => ({
    parseNum: jest.fn((val) => {
        if (val === undefined || val === null || val === '') return 0;
        const clean = String(val).replace(/[^0-9.-]+/g, '').replace(',', '.');
        const num = parseFloat(clean);
        return isNaN(num) ? 0 : num;
    }),
    formatCurrency: jest.fn((v) => v),
    formatDate: jest.fn(),
    getTodayString: jest.fn(() => '2025-01-01'),
    computeTotals: jest.fn(() => ({ diff: 0 }))
}));

// Provide minimal document before importing app.js
global.window = {};
global.document = {
    addEventListener: jest.fn(),
    getElementById: jest.fn()
};

// Dynamically import modules after mocks
await import('../app.js');
const ui = await import('../ui.js');
const utils = await import('../utils/index.js');

const { renderMovimientos, showAlert } = ui;
const { computeTotals } = utils;

describe('addMovimiento', () => {
    let elements;
    beforeEach(() => {
        elements = {
            tipoMovimiento: { value: 'entrada' },
            quienMovimiento: { value: '' },
            importeMovimiento: { value: '' },
            apertura: { value: '0' },
            ingresos: { value: '0' },
            cierre: { value: '0' },
            ingresosTarjetaExora: { value: '0' },
            ingresosTarjetaDatafono: { value: '0' },
            diferenciaDisplay: { className: '', innerHTML: '' },
            diferenciaTarjetaDisplay: { className: '', innerHTML: '' }
        };
        global.document = {
            getElementById: (id) => elements[id],
            addEventListener: jest.fn()
        };
        renderMovimientos.mockClear();
        computeTotals.mockClear();
        showAlert.mockClear();
    });

    test('window.addMovimiento is exposed', () => {
        expect(typeof window.addMovimiento).toBe('function');
    });

    test('addMovimiento agrega movimiento y recalcula', () => {
        elements.quienMovimiento.value = 'Juan';
        elements.importeMovimiento.value = '10';
        window.addMovimiento();
        expect(renderMovimientos).toHaveBeenCalledTimes(1);
        expect(renderMovimientos.mock.calls[0][0]).toEqual([
            { tipo: 'entrada', quien: 'Juan', importe: 10 }
        ]);
        expect(computeTotals).toHaveBeenCalled();
        expect(showAlert).not.toHaveBeenCalled();
    });

    test('addMovimiento valida importe negativo', () => {
        elements.importeMovimiento.value = '-5';
        window.addMovimiento();
        expect(showAlert).toHaveBeenCalled();
        expect(renderMovimientos).not.toHaveBeenCalled();
        expect(computeTotals).not.toHaveBeenCalled();
    });
});
