export function parseNum(value) {
    if (typeof value === 'number') return value;
    if (!value || value === '') return 0;

    let str = String(value).trim();
    // Remover símbolo de euro y otros caracteres no numéricos, excepto separadores decimales y signos
    str = str.replace(/[^\d,\.\-+]/g, '');

    if (str[0] === '-' || str[0] === '+') {
        const sign = str[0];
        str = sign + str.slice(1).replace(/[+-]/g, '');
    } else {
        str = str.replace(/[+-]/g, '');
    }

    if (!str) return 0;

    // Manejar separadores decimales europeos
    if (str.includes(',') && str.includes('.')) {
        // Si tiene ambos, asumimos que el punto son miles y la coma es decimal
        str = str.replace(/\./g, '').replace(',', '.');
    } else if (str.includes(',')) {
        // Solo coma, es separador decimal
        str = str.replace(',', '.');
    }

    const num = parseFloat(str);
    return isNaN(num) ? 0 : num;
}
