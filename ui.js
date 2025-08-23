import { formatCurrency, formatDate, computeTotals, parseNum } from './utils/index.js';
import { getDayIndex, loadDay } from './storage.js';

function loadLocalRecords(filteredDates) {
    let dates = getDayIndex();
    if (filteredDates) {
        dates = dates.filter(date => {
            const day = date.split('#')[0];
            return day >= filteredDates.desde && day <= filteredDates.hasta;
        });
    }
    return dates.map(key => {
        const data = loadDay(key);
        if (!data) return null;
        const [day, turno] = key.split('#');
        const totals = computeTotals(data.apertura, data.ingresos, data.movimientos, data.cierre);
        return {
            id: key,
            fecha: day,
            turno,
            hora: data.horaGuardado ? new Date(data.horaGuardado).toLocaleTimeString('es-ES') : '',
            sucursal: data.sucursal,
            apertura: parseNum(data.apertura),
            ingresos: parseNum(data.ingresos),
            tarjetaExora: parseNum(data.ingresosTarjetaExora || 0),
            tarjetaDatafono: parseNum(data.ingresosTarjetaDatafono || 0),
            entradas: totals.entradas,
            salidas: totals.salidas,
            total: totals.total,
            cierre: parseNum(data.cierre),
            dif: totals.diff,
        };
    }).filter(Boolean);
}

export function renderMovimientos(movimientos) {
    const container = document.getElementById('movimientosList');
    if (!container) return;

    if (!movimientos.length) {
        container.innerHTML = '<p style="text-align: center; color: var(--color-gris); padding: 20px;">No hay movimientos registrados</p>';
        return;
    }

    container.innerHTML = movimientos
        .map((mov, index) => {
            const nombre = mov.quien && mov.quien.trim() ? mov.quien.trim() : 'No especificado';
            const importe = typeof mov.importe === 'number' ? mov.importe : parseNum(mov.importe);

            return `
        <div class="movimiento-item">
            <strong>${mov.tipo === 'entrada' ? 'Entrada' : 'Salida'}</strong>
            <span class="movimiento-nombre">${nombre}</span>
            <span class="text-right movimiento-importe">${formatCurrency(importe)} €</span>
            <button type="button" class="btn btn-danger btn-small" onclick="removeMovimiento(${index})">🗑️</button>
        </div>`;
        })
        .join('');
}

export async function renderResumen(filteredDates, records) {
    const tbody = document.getElementById('resumenTable');
    const tfoot = document.getElementById('resumenTotals');

    if (!records) {
        records = [];
        const sucursal = localStorage.getItem('sucursal');
        if (typeof window !== 'undefined' && typeof fetch !== 'undefined') {
            try {
                let url = '/api/list-records';
                const params = [];
                if (filteredDates) {
                    params.push(`desde=${filteredDates.desde}`, `hasta=${filteredDates.hasta}`);
                }
                if (sucursal) {
                    params.push(`sucursal=${encodeURIComponent(sucursal)}`);
                }
                if (params.length) url += `?${params.join('&')}`;
                const res = await fetch(url, { cache: 'no-store' });
                if (res.ok) {
                    const json = await res.json();
                    records = json.records || [];
                }
            } catch (err) {
                console.error('No se pudo obtener desde Sheets', err);
            }
        }
        if (!records.length) {
            records = loadLocalRecords(filteredDates);
        }
    }

    if (!records.length) {
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="8" class="text-center">No hay datos para mostrar</td></tr>';
        }
        if (tfoot) {
            tfoot.innerHTML = '';
        }
        return;
    }

    const summary = {};
    records.forEach(r => {
        const day = r.fecha;
        if (!summary[day]) {
            summary[day] = { apertura: 0, ingresos: 0, entradas: 0, salidas: 0, total: 0, cierre: 0, diff: 0 };
        }
        summary[day].apertura += parseNum(r.apertura);
        summary[day].ingresos += parseNum(r.ingresos);
        summary[day].entradas += parseNum(r.entradas);
        summary[day].salidas += parseNum(r.salidas);
        summary[day].total += parseNum(r.total);
        summary[day].cierre += parseNum(r.cierre);
        summary[day].diff += parseNum(r.dif);
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
                <td data-label="Fecha">${formatDate(day)}</td>
                <td data-label="Apertura" class="text-right">${formatCurrency(sums.apertura)} €</td>
                <td data-label="Ingresos" class="text-right">${formatCurrency(sums.ingresos)} €</td>
                <td data-label="Entradas" class="text-right">${formatCurrency(sums.entradas)} €</td>
                <td data-label="Salidas" class="text-right">${formatCurrency(sums.salidas)} €</td>
                <td data-label="Total" class="text-right">${formatCurrency(sums.total)} €</td>
                <td data-label="Cierre" class="text-right">${formatCurrency(sums.cierre)} €</td>
                <td data-label="Dif." class="text-right" style="color: ${Math.abs(sums.diff) < 0.01 ? 'var(--color-exito)' : (sums.diff < 0 ? 'var(--color-peligro)' : 'var(--color-primario)')}">${formatCurrency(sums.diff)} €</td>
            </tr>
        `;
    }).join('');

    if (tbody) {
        tbody.innerHTML = rows;
    }

    if (tfoot) {
        tfoot.innerHTML = `
            <tr>
                <td data-label="Fecha">Total</td>
                <td data-label="Apertura" class="text-right">${formatCurrency(totalApertura)} €</td>
                <td data-label="Ingresos" class="text-right">${formatCurrency(totalIngresos)} €</td>
                <td data-label="Entradas" class="text-right">${formatCurrency(totalEntradas)} €</td>
                <td data-label="Salidas" class="text-right">${formatCurrency(totalSalidas)} €</td>
                <td data-label="Total" class="text-right">${formatCurrency(totalTotal)} €</td>
                <td data-label="Cierre" class="text-right">${formatCurrency(totalCierre)} €</td>
                <td data-label="Dif." class="text-right" style="color: ${Math.abs(totalDiff) < 0.01 ? 'var(--color-exito)' : (totalDiff < 0 ? 'var(--color-peligro)' : 'var(--color-primario)')}">${formatCurrency(totalDiff)} €</td>
            </tr>`;
    }
}

export async function renderHistorial(filteredDates) {
    const tbody = document.getElementById('historialTable');
    const sucursal = localStorage.getItem('sucursal');
    let records = [];

    if (typeof window !== 'undefined' && typeof fetch !== 'undefined') {
        try {
            let url = '/api/list-records';
            const params = [];
            if (filteredDates) {
                params.push(`desde=${filteredDates.desde}`, `hasta=${filteredDates.hasta}`);
            }
            if (sucursal) {
                params.push(`sucursal=${encodeURIComponent(sucursal)}`);
            }
            if (params.length) url += `?${params.join('&')}`;
            const res = await fetch(url, { cache: 'no-store' });
            if (res.ok) {
                const json = await res.json();
                records = json.records || [];
            }
        } catch (err) {
            console.error('No se pudo obtener desde Sheets', err);
        }
    }

    if (!records.length) {
        records = loadLocalRecords(filteredDates);
    }

    if (!records.length) {
        tbody.innerHTML = '<tr><td colspan="11" class="text-center">No hay datos para mostrar</td></tr>';
        await renderResumen(filteredDates, records);
        return;
    }

    records.sort((a, b) => {
        if (a.fecha === b.fecha) {
            return (b.turno || 0) - (a.turno || 0);
        }
        return b.fecha.localeCompare(a.fecha);
    });

    tbody.innerHTML = records.map(r => {
        const diffTarjeta = r.tarjetaExora - r.tarjetaDatafono;
        const safeId = String(r.id).replace(/[^a-z0-9]/gi, '_');
        return `
            <tr>
                <td data-label="Fecha">${formatDate(r.fecha)}${r.turno ? ` (Turno ${r.turno})` : ''}</td>
                <td data-label="Hora">${r.hora}</td>
                <td data-label="Sucursal">${r.sucursal}</td>
                <td data-label="Apertura" class="text-right">${formatCurrency(r.apertura)} €</td>
                <td data-label="Ingresos" class="text-right">${formatCurrency(r.ingresos)} €</td>
                <td data-label="Tarjeta Exora" class="text-right">${formatCurrency(r.tarjetaExora)} €</td>
                <td data-label="Tarjeta Datáfono" class="text-right">${formatCurrency(r.tarjetaDatafono)} €</td>
                <td data-label="Dif. Tarjeta" class="text-right" style="color: ${Math.abs(diffTarjeta) < 0.01 ? 'var(--color-exito)' : (diffTarjeta < 0 ? 'var(--color-peligro)' : 'var(--color-primario)')}">${formatCurrency(diffTarjeta)} €</td>
                <td data-label="Entradas" class="text-right">${formatCurrency(r.entradas)} €</td>
                <td data-label="Salidas" class="text-right">${formatCurrency(r.salidas)} €</td>
                <td data-label="Total" class="text-right">${formatCurrency(r.total)} €</td>
                <td data-label="Cierre" class="text-right">${formatCurrency(r.cierre)} €</td>
                <td data-label="Dif." class="text-right" style="color: ${Math.abs(r.dif) < 0.01 ? 'var(--color-exito)' : (r.dif < 0 ? 'var(--color-peligro)' : 'var(--color-primario)')}">${formatCurrency(r.dif)} €</td>
                <td data-label="Acciones" class="text-center">
                    <div class="actions-dropdown">
                        <button class="btn btn-secondary btn-small" onclick="toggleActionsMenu('actions-${safeId}')">⋮</button>
                        <div id="actions-${safeId}" class="dropdown-menu">
                            <button onclick="closeAllActionsMenus(); editDay('${r.id}')">Editar</button>
                            <button onclick="closeAllActionsMenus(); emailDay('${r.id}')">Enviar por email</button>
                            <button onclick="closeAllActionsMenus(); downloadDayCSV('${r.id}')">Descargar CSV</button>
                            <button class="delete" onclick="closeAllActionsMenus(); deleteDayFromHistorial('${r.id}', '${r.fecha}')">Eliminar</button>
                        </div>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    await renderResumen(filteredDates, records);
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
