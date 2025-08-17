import { parseNum } from './parseNum.js';

export function formatCurrency(value) {
    const num = parseNum(value);
    return num.toLocaleString('es-ES', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}
