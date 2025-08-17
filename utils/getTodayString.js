export function getTodayString() {
    const today = new Date();
    return today.toISOString().split('T')[0];
}
