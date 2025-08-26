// Filter management module
import { appState } from './state.js';
import { renderHistorial } from '../ui.js';

export function setActiveChip(id) {
    document.querySelectorAll('.chip').forEach(chip => {
        chip.classList.toggle('active', chip.id === id);
    });
}

export function filterToday() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('fechaDesde').value = today;
    document.getElementById('fechaHasta').value = today;
    setActiveChip('chipToday');
    applyDateFilter();
}

export function filterThisWeek() {
    const today = new Date();
    const monday = new Date(today.setDate(today.getDate() - today.getDay() + 1));
    const sunday = new Date(today.setDate(today.getDate() - today.getDay() + 7));
    
    document.getElementById('fechaDesde').value = monday.toISOString().split('T')[0];
    document.getElementById('fechaHasta').value = sunday.toISOString().split('T')[0];
    setActiveChip('chipWeek');
    applyDateFilter();
}

export function filterThisMonth() {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    
    document.getElementById('fechaDesde').value = firstDay.toISOString().split('T')[0];
    document.getElementById('fechaHasta').value = lastDay.toISOString().split('T')[0];
    setActiveChip('chipMonth');
    applyDateFilter();
}

export function applyDateFilter() {
    const desde = document.getElementById('fechaDesde').value;
    const hasta = document.getElementById('fechaHasta').value;
    
    if (!desde || !hasta) {
        alert('Por favor selecciona ambas fechas');
        return;
    }
    
    if (desde > hasta) {
        alert('La fecha de inicio no puede ser posterior a la fecha de fin');
        return;
    }
    
    appState.setFilteredDates({ desde, hasta });
    renderHistorial(appState.getFilteredDates());
}

export function clearDateFilter() {
    document.getElementById('fechaDesde').value = '';
    document.getElementById('fechaHasta').value = '';
    document.querySelectorAll('.chip').forEach(chip => chip.classList.remove('active'));
    appState.setFilteredDates(null);
    renderHistorial(null);
}