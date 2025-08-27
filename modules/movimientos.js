// Movimientos management module
import { parseNum } from '../utils/index.js';
import { appState } from './state.js';
import { renderMovimientos } from '../ui.js';

export function addMovimiento() {
    if (typeof document === 'undefined') return;
    
    const tipo = document.getElementById('tipoMovimiento').value;
    const quien = document.getElementById('quienMovimiento').value;
    const importeStr = document.getElementById('importeMovimiento').value;
    
    if (!quien.trim()) {
        if (typeof alert !== 'undefined') {
            alert('Por favor selecciona quién realizó el movimiento');
        }
        return;
    }
    
    if (!importeStr.trim()) {
        if (typeof alert !== 'undefined') {
            alert('Por favor introduce el importe');
        }
        return;
    }
    
    const importe = parseNum(importeStr);
    if (isNaN(importe) || importe <= 0) {
        if (typeof alert !== 'undefined') {
            alert('Por favor introduce un importe válido mayor que 0');
        }
        return;
    }
    
    const movimiento = { tipo, quien: quien.trim(), importe };
    appState.addMovimiento(movimiento);
    
    // Limpiar formulario
    if (typeof document !== 'undefined') {
        document.getElementById('quienMovimiento').value = '';
        document.getElementById('importeMovimiento').value = '';
    }
    
    renderMovimientos(appState.getMovimientos());
    calculateAndUpdateDiferencias();
}

export function removeMovimiento(index) {
    appState.removeMovimiento(index);
    renderMovimientos(appState.getMovimientos());
    calculateAndUpdateDiferencias();
}

function calculateAndUpdateDiferencias() {
    // Trigger recalculation - this function exists in app.js
    if (typeof window.recalc === 'function') {
        window.recalc();
    }
}

// Make functions globally available for onclick handlers
if (typeof window !== 'undefined') {
    window.addMovimiento = addMovimiento;
    window.removeMovimiento = removeMovimiento;
}