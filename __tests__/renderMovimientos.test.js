import { describe, beforeEach, test, expect } from '@jest/globals';
import { renderMovimientos } from '../ui.js';

describe('renderMovimientos', () => {
    let container;
    beforeEach(() => {
        container = { innerHTML: '' };
        global.document = {
            getElementById: () => container
        };
    });

    test('muestra mensaje cuando no hay movimientos', () => {
        renderMovimientos([]);
        expect(container.innerHTML).toContain('No hay movimientos');
    });

    test('renderiza la lista de movimientos', () => {
        const movimientos = [
            { tipo: 'entrada', quien: 'Ana', importe: 5 }
        ];
        renderMovimientos(movimientos);
        expect(container.innerHTML).toContain('movimiento-item');
        expect(container.innerHTML).toContain('Ana');
    });
});
