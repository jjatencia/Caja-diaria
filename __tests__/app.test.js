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

// Dynamically import modules after mocks
await import('../app.js');
const ui = await import('../ui.js');
const utils = await import('../utils/index.js');

const { renderMovimientos, showAlert } = ui;
const { computeTotals } = utils;

describe('addMovimiento', () => {
    let elements;
    beforeEach(() => {
        store = {};
        global.localStorage.setItem.mockImplementation((k, v) => { store[k] = v; });
        global.localStorage.getItem.mockImplementation((k) => store[k] || null);
        global.localStorage.removeItem.mockImplementation((k) => { delete store[k]; });
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
            diferenciaTarjetaDisplay: { className: '', innerHTML: '' },
            fecha: { value: '2025-01-01' },
            responsableApertura: { value: '' },
            responsableCierre: { value: '' },
            currentSucursal: { textContent: '' }
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

describe('changeSucursal', () => {
    let elements, saveHandler;

    beforeEach(() => {
        store = { sucursal: 'Antigua' };
        global.localStorage.setItem.mockImplementation((k, v) => { store[k] = v; });
        global.localStorage.getItem.mockImplementation((k) => store[k] || null);
        global.localStorage.removeItem.mockImplementation((k) => { delete store[k]; });

        saveHandler = null;
        elements = {
            sucursalSetup: { style: { display: 'none' } },
            guardarSucursal: { addEventListener: (evt, handler) => { saveHandler = handler; } },
            sucursalInicial: { value: '' },
            currentSucursal: { textContent: '' }
        };
        global.document = {
            getElementById: (id) => elements[id]
        };
    });

    test('changeSucursal actualiza la sucursal almacenada', () => {
        window.changeSucursal();
        expect(elements.sucursalSetup.style.display).toBe('flex');
        elements.sucursalInicial.value = 'Nueva';
        saveHandler();
        expect(store['sucursal']).toBe('Nueva');
        expect(elements.currentSucursal.textContent).toBe('Nueva');
        expect(elements.sucursalSetup.style.display).toBe('none');
    });
});

describe('saveDay', () => {
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
            responsableCierre: { value: '' }
        };
        global.document = {
            getElementById: (id) => elements[id],
            addEventListener: jest.fn()
        };
    });

    test('saveDay almacena hora de guardado', async () => {
        store['sucursal'] = 'Central';
        await window.saveDay();
        const index = JSON.parse(store['caja:index']);
        const key = index[0];
        const saved = JSON.parse(store[`caja:${key}`]);
        expect(saved.horaGuardado).toBeDefined();
    });
});
