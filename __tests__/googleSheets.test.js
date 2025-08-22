import { buildTesoreriaRow } from '../api/googleSheets.js';

describe('buildTesoreriaRow', () => {
  test('includes quien in the row', () => {
    const row = buildTesoreriaRow('1', '2024-01-01', {
      tipo: 'entrada',
      quien: 'Juan',
      importe: 10,
    });
    expect(row).toEqual(['1', '2024-01-01', 'Entrada', 'Juan', 10]);
  });
});
