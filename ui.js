import { formatCurrency, formatDate, computeTotals, parseNum } from './utils/index.js';
import { getDayIndex, loadDay } from './storage.js';

export function renderMovimientos(movimientos) {
    const container = document.getElementById('movimientosList');

    if (!movimientos.length) {
        container.innerHTML = '<p style="text-align: center; color: var(--color-gris); padding: 20px;">No hay movimientos registrados</p>';
        return;
    }

    container.innerHTML = movimientos.map((mov, index) => `
        <div class="movimiento-item">
            <strong>${mov.tipo === 'entrada' ? 'Entrada' : 'Salida'}</strong>
            <span>${mov.quien || 'No especificado'}</span>
            <span class="text-right">${formatCurrency(mov.importe)} €</span>
            <button type="button" class="btn btn-danger btn-small" onclick="removeMovimiento(${index})">🗑️</button>
        </div>
    `).join('');
}

export function renderResumen(filteredDates) {
    const tbody = document.getElementById('resumenTable');
    const tfoot = document.getElementById('resumenTotals');
    let dates = getDayIndex();

    if (filteredDates) {
        dates = dates.filter(date => {
            const day = date.split('#')[0];
            return day >= filteredDates.desde && day <= filteredDates.hasta;
        });
    }

    if (!dates.length) {
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="8" class="text-center">No hay datos para mostrar</td></tr>';
        }
        if (tfoot) {
            tfoot.innerHTML = '';
        }
        return;
    }

    const summary = {};
    dates.forEach(key => {
        const day = key.split('#')[0];
        const data = loadDay(key);
        if (!data) return;
        const totals = computeTotals(data.apertura, data.ingresos, data.movimientos, data.cierre);
        if (!summary[day]) {
            summary[day] = { apertura: 0, ingresos: 0, entradas: 0, salidas: 0, total: 0, cierre: 0, diff: 0 };
        }
        summary[day].apertura += parseNum(data.apertura);
        summary[day].ingresos += parseNum(data.ingresos);
        summary[day].entradas += totals.entradas;
        summary[day].salidas += totals.salidas;
        summary[day].total += totals.total;
        summary[day].cierre += parseNum(data.cierre);
        summary[day].diff += totals.diff;
    });

    const days = Object.keys(summary).sort((a, b) => b.localeCompare(a));
    let totalApertura = 0,
        totalIngresos = 0,
        totalEntradas = 0,
        totalSalidas = 0,
        totalTotal = 0,
        totalCierre = 0,
        totalDiff = 0;

    const rows = days.map(day => {
        const sums = summary[day];
        totalApertura += sums.apertura;
        totalIngresos += sums.ingresos;
        totalEntradas += sums.entradas;
        totalSalidas += sums.salidas;
        totalTotal += sums.total;
        totalCierre += sums.cierre;
        totalDiff += sums.diff;
        return `
            <tr>
                <td>${formatDate(day)}</td>
                <td class="text-right">${formatCurrency(sums.apertura)} €</td>
                <td class="text-right">${formatCurrency(sums.ingresos)} €</td>
                <td class="text-right">${formatCurrency(sums.entradas)} €</td>
                <td class="text-right">${formatCurrency(sums.salidas)} €</td>
                <td class="text-right">${formatCurrency(sums.total)} €</td>
                <td class="text-right">${formatCurrency(sums.cierre)} €</td>
                <td class="text-right" style="color: ${Math.abs(sums.diff) < 0.01 ? 'var(--color-exito)' : (sums.diff < 0 ? 'var(--color-peligro)' : 'var(--color-primario)')}">${formatCurrency(sums.diff)} €</td>
            </tr>
        `;
    }).join('');

    if (tbody) {
        tbody.innerHTML = rows;
    }

    if (tfoot) {
        tfoot.innerHTML = `
            <tr>
                <td>Total</td>
                <td class="text-right">${formatCurrency(totalApertura)} €</td>
                <td class="text-right">${formatCurrency(totalIngresos)} €</td>
                <td class="text-right">${formatCurrency(totalEntradas)} €</td>
                <td class="text-right">${formatCurrency(totalSalidas)} €</td>
                <td class="text-right">${formatCurrency(totalTotal)} €</td>
                <td class="text-right">${formatCurrency(totalCierre)} €</td>
                <td class="text-right" style="color: ${Math.abs(totalDiff) < 0.01 ? 'var(--color-exito)' : (totalDiff < 0 ? 'var(--color-peligro)' : 'var(--color-primario)')}">${formatCurrency(totalDiff)} €</td>
            </tr>`;
    }
}

export function renderHistorial(filteredDates) {
    const tbody = document.getElementById('historialTable');
    let dates = getDayIndex();

    if (filteredDates) {
        dates = dates.filter(date => {
            const day = date.split('#')[0];
            return day >= filteredDates.desde && day <= filteredDates.hasta;
        });
    }

    if (!dates.length) {
        tbody.innerHTML = '<tr><td colspan="11" class="text-center">No hay datos para mostrar</td></tr>';
        return;
    }

    dates.sort((a, b) => {
        const [dateA, turnoA] = a.split('#');
        const [dateB, turnoB] = b.split('#');
        if (dateA === dateB) {
            return Number(turnoB || 0) - Number(turnoA || 0);
        }
        return dateB.localeCompare(dateA);
    });

    tbody.innerHTML = dates.map(date => {
        const data = loadDay(date);
        if (!data) return '';
        const [day, turno] = date.split('#');
        const totals = computeTotals(data.apertura, data.ingresos, data.movimientos, data.cierre);

        const hora = data.horaGuardado ? new Date(data.horaGuardado).toLocaleTimeString('es-ES') : '';
        const safeId = date.replace(/[^a-z0-9]/gi, '_');

        return `
            <tr>
                <td>${formatDate(day)}${turno ? ` (Turno ${turno})` : ''}</td>
                <td>${hora}</td>
                <td>${data.sucursal}</td>
                <td class="text-right">${formatCurrency(data.apertura)} €</td>
                <td class="text-right">${formatCurrency(data.ingresos)} €</td>
                <td class="text-right">${formatCurrency(totals.entradas)} €</td>
                <td class="text-right">${formatCurrency(totals.salidas)} €</td>
                <td class="text-right">${formatCurrency(totals.total)} €</td>
                <td class="text-right">${formatCurrency(data.cierre)} €</td>
                <td class="text-right" style="color: ${Math.abs(totals.diff) < 0.01 ? 'var(--color-exito)' : (totals.diff < 0 ? 'var(--color-peligro)' : 'var(--color-primario)')}">${formatCurrency(totals.diff)} €</td>
                <td class="text-center">
                    <div class="actions-dropdown">
                        <button class="btn btn-secondary btn-small" onclick="toggleActionsMenu('actions-${safeId}')">⋮</button>
                        <div id="actions-${safeId}" class="dropdown-menu">
                            <button onclick="closeAllActionsMenus(); editDay('${date}')">Editar</button>
                            <button onclick="closeAllActionsMenus(); emailDay('${date}')">Enviar por email</button>
                            <button onclick="closeAllActionsMenus(); downloadDayCSV('${date}')">Descargar CSV</button>
                            <button class="delete" onclick="closeAllActionsMenus(); deleteDayFromHistorial('${date}')">Eliminar</button>
                        </div>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    renderResumen(filteredDates);
}

export function showAlert(message, type = 'info') {
    const existingAlerts = document.querySelectorAll('.alert');
    existingAlerts.forEach(alert => alert.remove());

    const alert = document.createElement('div');
    alert.className = `alert alert-${type}`;
    alert.textContent = message;

    const header = document.querySelector('.header');
    header.parentNode.insertBefore(alert, header.nextSibling);

    setTimeout(() => {
        if (alert.parentNode) {
            alert.remove();
        }
    }, 5000);
}

export function displayTestResults(results) {
    const panel = document.getElementById('testsPanel');
    const resultsDiv = document.getElementById('testResults');

    const allPassed = results.every(r => r.passed);

    if (allPassed) {
        console.log('🎉 Todos los tests pasaron correctamente');
        showAlert('Todos los tests pasaron correctamente', 'success');
    } else {
        resultsDiv.innerHTML = results.map(result => {
            const className = result.passed ? 'test-pass' : 'test-fail';
            const icon = result.passed ? '✅' : '❌';
            const errorText = result.error ? ` - ${result.error}` : '';
            return `<div class="${className}">${icon} ${result.name}${errorText}</div>`;
        }).join('');

        panel.classList.add('show');
    }
}

export function hideTests() {
    document.getElementById('testsPanel').classList.remove('show');
}
