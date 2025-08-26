// State management module
export class AppState {
    constructor() {
        this.currentMovimientos = [];
        this.filteredDates = null;
        this.currentEditKey = null;
        this.API_KEY = globalThis.API_KEY || '';
    }

    // Getters
    getMovimientos() {
        return this.currentMovimientos;
    }

    getFilteredDates() {
        return this.filteredDates;
    }

    getCurrentEditKey() {
        return this.currentEditKey;
    }

    getApiKey() {
        return this.API_KEY;
    }

    // Setters
    setMovimientos(movimientos) {
        this.currentMovimientos = movimientos || [];
    }

    setFilteredDates(dates) {
        this.filteredDates = dates;
    }

    setCurrentEditKey(key) {
        this.currentEditKey = key;
    }

    addMovimiento(movimiento) {
        this.currentMovimientos.push(movimiento);
    }

    removeMovimiento(index) {
        if (index >= 0 && index < this.currentMovimientos.length) {
            this.currentMovimientos.splice(index, 1);
        }
    }

    clearMovimientos() {
        this.currentMovimientos = [];
    }

    // Reset state
    reset() {
        this.currentMovimientos = [];
        this.filteredDates = null;
        this.currentEditKey = null;
    }
}

// Global state instance
export const appState = new AppState();