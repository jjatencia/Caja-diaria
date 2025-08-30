import { parseNum } from './parseNum.js';

export function formatCurrency(value, includeSymbol = false) {
    const num = parseNum(value);
    const formatted = num.toLocaleString('es-ES', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
    return includeSymbol ? `${formatted} €` : formatted;
}
