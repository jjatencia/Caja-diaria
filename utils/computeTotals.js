import { parseNum } from './parseNum.js';

export function computeTotals(apertura, ingresos, movimientos, cierre) {
    const aperturaNum = parseNum(apertura);
    const ingresosNum = parseNum(ingresos);
    const cierreNum = parseNum(cierre);

    let entradas = 0;
    let salidas = 0;

    if (Array.isArray(movimientos)) {
        movimientos.forEach(mov => {
            if (mov && typeof mov === 'object') {
                const importe = parseNum(mov.importe);
                if (mov.tipo === 'entrada') {
                    entradas += importe;
                } else if (mov.tipo === 'salida') {
                    salidas += importe;
                }
            }
        });
    }

    const total = aperturaNum + ingresosNum + entradas - salidas;
    const diff = cierreNum - total;

    return {
        entradas,
        salidas,
        total,
        diff
    };
}
