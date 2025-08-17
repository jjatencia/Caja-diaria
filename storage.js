export function saveToLocalStorage(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
}

export function getFromLocalStorage(key) {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : null;
}

export function getDayIndex() {
    return getFromLocalStorage('caja:index') || [];
}

export function updateDayIndex(date, action = 'add') {
    let index = getDayIndex();

    if (action === 'add') {
        if (!index.includes(date)) {
            index.push(date);
            index.sort();
        }
    } else if (action === 'remove') {
        index = index.filter(d => d !== date);
    }

    saveToLocalStorage('caja:index', index);
}

export function loadDay(date) {
    return getFromLocalStorage(`caja:${date}`);
}

export function saveDayData(date, data) {
    saveToLocalStorage(`caja:${date}`, data);
    updateDayIndex(date, 'add');
}

export function deleteDay(date) {
    localStorage.removeItem(`caja:${date}`);
    updateDayIndex(date, 'remove');
}
