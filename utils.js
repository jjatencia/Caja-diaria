export function parseNum(value) {
    if (typeof value === 'number') return value;
    if (!value || value === '') return 0;

    let str = String(value).trim();
    str = str.replace(/[^\d,\.\-+]/g, '');

    if (str[0] === '-' || str[0] === '+') {
        const sign = str[0];
        str = sign + str.slice(1).replace(/[+-]/g, '');
    } else {
        str = str.replace(/[+-]/g, '');
    }

    if (!str) return 0;

    if (str.includes(',') && str.includes('.')) {
        str = str.replace(/\./g, '').replace(',', '.');
    } else if (str.includes(',')) {
        str = str.replace(',', '.');
    }

    const num = parseFloat(str);
    return isNaN(num) ? 0 : num;
}

export function formatCurrency(value) {
    const num = parseNum(value);
    return num.toLocaleString('es-ES', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

export function formatDate(dateStr) {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('es-ES');
}

export function getTodayString() {
    const today = new Date();
    return today.toISOString().split('T')[0];
}

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
    const diff = total - cierreNum;

    return {
        entradas,
        salidas,
        total,
        diff
    };
}
