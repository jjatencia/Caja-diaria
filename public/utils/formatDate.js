export function formatDate(dateStr) {
    const base = dateStr.split('T')[0].split('#')[0];
    const date = new Date(base + 'T00:00:00');
    return date.toLocaleDateString('es-ES');
}
