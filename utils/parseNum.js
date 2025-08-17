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
