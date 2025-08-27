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
    
    // Calcular inicio de semana (lunes) sin mutar la fecha original
    const dayOfWeek = today.getDay(); // 0 = domingo, 1 = lunes, etc.
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Si es domingo, retroceder 6 días
    
    const monday = new Date(today);
    monday.setDate(today.getDate() + mondayOffset);
    
    // Calcular fin de semana (domingo)
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    
    // Convertir a string sin problemas de zona horaria
    const mondayStr = new Date(monday.getTime() - monday.getTimezoneOffset() * 60000)
        .toISOString()
        .split('T')[0];
    const sundayStr = new Date(sunday.getTime() - sunday.getTimezoneOffset() * 60000)
        .toISOString()
        .split('T')[0];
    
    document.getElementById('fechaDesde').value = mondayStr;
    document.getElementById('fechaHasta').value = sundayStr;
    setActiveChip('chipWeek');
    applyDateFilter();
}

export function filterThisMonth() {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth(); // 0-11
    
    // Primer día del mes
    const firstDay = new Date(year, month, 1);
    
    // Último día del mes
    const lastDay = new Date(year, month + 1, 0);
    
    // Convertir a string sin problemas de zona horaria
    const firstDayStr = new Date(firstDay.getTime() - firstDay.getTimezoneOffset() * 60000)
        .toISOString()
        .split('T')[0];
    const lastDayStr = new Date(lastDay.getTime() - lastDay.getTimezoneOffset() * 60000)
        .toISOString()
        .split('T')[0];
    
    document.getElementById('fechaDesde').value = firstDayStr;
    document.getElementById('fechaHasta').value = lastDayStr;
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