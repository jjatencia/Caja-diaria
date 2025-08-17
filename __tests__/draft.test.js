import { describe, beforeEach, test, expect, jest } from '@jest/globals';

jest.unstable_mockModule('../ui.js', () => ({
    renderMovimientos: jest.fn(),
    renderHistorial: jest.fn(),
    showAlert: jest.fn(),
    displayTestResults: jest.fn(),
    hideTests: jest.fn()
}));

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

global.window = {};
let store = {};
global.localStorage = {
    setItem: jest.fn((k, v) => { store[k] = v; }),
    getItem: jest.fn((k) => store[k] || null),
    removeItem: jest.fn((k) => { delete store[k]; })
};

global.document = {
    addEventListener: jest.fn(),
    getElementById: jest.fn()
};

await import('../app.js');
const ui = await import('../ui.js');
const utils = await import('../utils/index.js');

const { renderMovimientos } = ui;
const { computeTotals } = utils;

describe('draft persistence', () => {
    let elements;
    beforeEach(() => {
        store = {};
        global.localStorage.setItem.mockImplementation((k, v) => { store[k] = v; });
        global.localStorage.getItem.mockImplementation((k) => store[k] || null);
        global.localStorage.removeItem.mockImplementation((k) => { delete store[k]; });

        elements = {
            fecha: { value: '2025-01-01' },
            apertura: { value: '0' },
            responsableApertura: { value: '' },
            ingresos: { value: '0' },
            ingresosTarjetaExora: { value: '0' },
            ingresosTarjetaDatafono: { value: '0' },
            cierre: { value: '0' },
            responsableCierre: { value: '' },
            tipoMovimiento: { value: 'entrada' },
            quienMovimiento: { value: '' },
            importeMovimiento: { value: '' },
            diferenciaDisplay: { className: '', innerHTML: '' },
            diferenciaTarjetaDisplay: { className: '', innerHTML: '' },
            currentSucursal: { textContent: '' }
        };
        global.document = {
            getElementById: (id) => elements[id],
            addEventListener: jest.fn()
        };
        renderMovimientos.mockClear();
        computeTotals.mockClear();
    });

    test('addMovimiento saves draft data', () => {
        elements.importeMovimiento.value = '5';
        window.addMovimiento();
        const draft = JSON.parse(store['caja:draft']);
        expect(draft.movimientos).toHaveLength(1);
        expect(draft.movimientos[0].importe).toBe(5);
    });

    test('loadDraft restores saved data', () => {
        const draftData = {
            fecha: '2025-02-02',
            sucursal: 'Sucursal1',
            apertura: 10,
            responsableApertura: 'Ana',
            ingresos: 20,
            ingresosTarjetaExora: 0,
            ingresosTarjetaDatafono: 0,
            movimientos: [{ tipo: 'salida', quien: 'Luis', importe: 5 }],
            cierre: 25,
            responsableCierre: 'Carlos'
        };
        store['caja:draft'] = JSON.stringify(draftData);
        elements.fecha.value = '';
        renderMovimientos.mockClear();
        window.loadDraft();
        expect(elements.fecha.value).toBe('2025-02-02');
        expect(store['sucursal']).toBe('Sucursal1');
        expect(elements.currentSucursal.textContent).toBe('Sucursal1');
        expect(renderMovimientos).toHaveBeenCalledWith(draftData.movimientos);
    });
});
