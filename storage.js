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
        }
    } else if (action === 'remove') {
        index = index.filter(d => d !== date);
    }

    index.sort((a, b) => a.localeCompare(b));
    saveToLocalStorage('caja:index', index);
}

export function loadDay(date) {
    return getFromLocalStorage(`caja:${date}`);
}

export function saveDayData(date, data, existingKey = null) {
    let key = existingKey;

    if (existingKey) {
        if (existingKey.startsWith(date)) {
            saveToLocalStorage(`caja:${existingKey}`, data);
            updateDayIndex(existingKey, 'add');
            return existingKey;
        } else {
            deleteDay(existingKey);
            key = null;
        }
    }

    if (!key) {
        const index = getDayIndex();
        const count = index.filter(d => d.startsWith(date)).length;
        key = `${date}#${count + 1}`;
    }

    saveToLocalStorage(`caja:${key}`, data);
    updateDayIndex(key, 'add');
    return key;
}

export function deleteDay(date) {
    const data = loadDay(date);
    localStorage.removeItem(`caja:${date}`);
    updateDayIndex(date, 'remove');

    if (data?.sheetId && typeof fetch !== 'undefined') {
        try {
            fetch('/api/delete-record', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: data.sheetId })
            });
        } catch (err) {
            console.error('No se pudo borrar en Sheets', err);
        }
    }
}
