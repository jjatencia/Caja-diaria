import { parseNum, formatCurrency, formatDate, getTodayString, computeTotals } from "./utils/index.js";
import { getDayIndex, loadDay, saveDayData, deleteDay, saveToLocalStorage, getFromLocalStorage } from "./storage.js";
import { renderMovimientos, renderHistorial, showAlert, displayTestResults, hideTests } from "./ui.js";
import { appState } from "./modules/state.js";
import { empleadosPorSucursal, updateResponsables, applySucursal } from "./modules/employees.js";
import { setActiveChip, filterToday, filterThisWeek, filterThisMonth, applyDateFilter, clearDateFilter } from "./modules/filters.js";
import { addMovimiento, removeMovimiento } from "./modules/movimientos.js";
import { apiRequest, isStaticHosting } from "./modules/api-fallback.js";

function updateViewportHeight() {
    const vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
}

if (typeof window !== 'undefined' && window.addEventListener) {
    window.addEventListener('resize', updateViewportHeight);
    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', updateViewportHeight);
    }
    updateViewportHeight();
}
// SERVICE WORKER DESACTIVADO - BYPASS TOTAL DE CACHE
console.log('🚫 Service Worker desactivado para evitar problemas de cache');

// Limpiar Service Worker existente
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(registrations => {
        registrations.forEach(registration => {
            registration.unregister();
            console.log('SW desregistrado:', registration.scope);
        });
    });
}

if (false && 'serviceWorker' in navigator) {
    navigator.serviceWorker.register('./service-worker.js', { updateViaCache: 'none' }).then(registration => {
        registration.addEventListener('updatefound', () => {
            console.log('[SW] Update found');
            const newWorker = registration.installing;
            if (newWorker) {
                newWorker.addEventListener('statechange', () => {
                    console.log('[SW] state changed:', newWorker.state);
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        const prompt = document.getElementById('updatePrompt');
                        const reloadBtn = document.getElementById('reloadApp');
                        if (prompt && reloadBtn) {
                            prompt.style.display = 'flex';
                            reloadBtn.addEventListener('click', () => window.location.reload(), { once: true });
                        }
                    }
                });
            }
        });
        // Trigger a check for an updated service worker after the listener is attached
        registration.update();
    });
}

if (typeof document !== 'undefined' && typeof localStorage !== 'undefined') {
  const btn = document.getElementById('themeToggle');
  const PREF = 'theme';
  const apply = (t) => { if (document.documentElement) document.documentElement.dataset.theme = t; };
  const next  = () => (localStorage.getItem(PREF) === 'light' ? 'dark' : 'light');
  apply(localStorage.getItem(PREF) || 'dark');
  if (btn) btn.onclick = () => { const n = next(); localStorage.setItem(PREF, n); apply(n); };
}

// Use centralized state management
const API_KEY = appState.getApiKey();

// Functions moved to modules - imported above

function handleSucursalSave(e) {
    e.preventDefault();
    const modal = document.getElementById('sucursalSetup');
    const selectInicial = document.getElementById('sucursalInicial');
    if (selectInicial) {
        const selected = selectInicial.value;
        localStorage.setItem('sucursal', selected);
    }
    if (modal) {
        modal.style.display = 'none';
    }
    applySucursal();
}

function openSucursalModal() {
    const modal = document.getElementById('sucursalSetup');
    const selectInicial = document.getElementById('sucursalInicial');
    if (modal && selectInicial) {
        const current = localStorage.getItem('sucursal');
        if (current) {
            selectInicial.value = current;
        }
        modal.style.display = 'flex';
    }
}

function initializeSucursal() {
    const saved = localStorage.getItem('sucursal');
    if (saved) {
        applySucursal();
    } else {
        openSucursalModal();
    }
}

function changeSucursal() {
    openSucursalModal();
}

function saveDraft() {
    const draft = {
        fecha: document.getElementById('fecha').value,
        sucursal: localStorage.getItem('sucursal'),
        apertura: parseNum(document.getElementById('apertura').value),
        responsableApertura: document.getElementById('responsableApertura').value.trim(),
        ingresos: parseNum(document.getElementById('ingresos').value),
        ingresosTarjetaExora: parseNum(document.getElementById('ingresosTarjetaExora').value),
        ingresosTarjetaDatafono: parseNum(document.getElementById('ingresosTarjetaDatafono').value),
        movimientos: [...appState.getMovimientos()],
        cierre: parseNum(document.getElementById('cierre').value),
        responsableCierre: document.getElementById('responsableCierre').value.trim()
    };
    saveToLocalStorage('caja:draft', draft);
}

function loadDraft() {
    const draft = getFromLocalStorage('caja:draft');
    if (draft) {
        loadFormData(draft);
    }
}

// Funciones de UI
function recalc() {
    const apertura = document.getElementById('apertura').value;
    const ingresos = document.getElementById('ingresos').value;
    const cierre = document.getElementById('cierre').value;
    
    const totals = computeTotals(apertura, ingresos, appState.getMovimientos(), cierre);

    const diferenciaDiv = document.getElementById('diferenciaDisplay');
    if (diferenciaDiv) {
        const diffFormatted = formatCurrency(totals.diff);
        if (Math.abs(totals.diff) < 0.01) {
            diferenciaDiv.className = 'diferencia cero';
            diferenciaDiv.innerHTML = `✅ Diferencia Efectivo: ${diffFormatted} € - ¡Cuadra!`;
        } else if (totals.diff > 0) {
            diferenciaDiv.className = 'diferencia positivo';
            diferenciaDiv.innerHTML = `⚠️ Diferencia Efectivo: ${diffFormatted} € - Sobra dinero`;
        } else {
            diferenciaDiv.className = 'diferencia negativo';
            diferenciaDiv.innerHTML = `⚠️ Diferencia Efectivo: ${diffFormatted} € - Falta dinero`;
        }
    }

    // Si falta dinero, intenta enviar una alerta solo si hay API_KEY y no es hosting estático
    if (totals.diff < 0 && API_KEY && !isStaticHosting()) {
        const alertData = {
            sucursal: localStorage.getItem('sucursal'),
            fecha: document.getElementById('fecha').value,
            diferencia: totals.diff,
            detalle: appState.getMovimientos()
                .map(m => `${m.tipo} - ${m.quien}: ${formatCurrency(m.importe)} €`)
                .join('\n')
        };
        
        apiRequest('/api/send-alert', {
            method: 'POST',
            body: JSON.stringify(alertData),
            headers: {
                'Content-Type': 'application/json',
                'Authorization': API_KEY
            }
        })
            .then(result => {
                if (result && result.success) {
                    showAlert('Alerta enviada', 'success');
                } else {
                    showAlert('No se pudo enviar la alerta', 'danger');
                }
            })
            .catch(() => {
                if ('serviceWorker' in navigator) {
                    navigator.serviceWorker.ready.then(registration => {
                        if (registration.sync) {
                            registration.sync.register('send-alert');
                            navigator.serviceWorker.controller?.postMessage({
                                type: 'queue-alert',
                                payload: alertData
                            });
                        }
                    });
                }
                showAlert('Alerta enviada en segundo plano', 'info');
            });
    }

    // Calcular diferencia de tarjeta
    const ingresosTarjetaExora = parseNum(document.getElementById('ingresosTarjetaExora').value);
    const ingresosTarjetaDatafono = parseNum(document.getElementById('ingresosTarjetaDatafono').value);
    const diferenciaTarjeta = ingresosTarjetaDatafono - ingresosTarjetaExora;
    
    const diferenciaTarjetaDiv = document.getElementById('diferenciaTarjetaDisplay');
    if (diferenciaTarjetaDiv) {
        const diffTarjetaFormatted = formatCurrency(diferenciaTarjeta);

        if (Math.abs(diferenciaTarjeta) < 0.01) {
            diferenciaTarjetaDiv.className = 'diferencia cuadra';
            diferenciaTarjetaDiv.innerHTML = `✅ Diferencia Tarjeta: ${diffTarjetaFormatted} € - ¡Cuadra!`;
        } else if (diferenciaTarjeta > 0) {
            diferenciaTarjetaDiv.className = 'diferencia positivo';
            diferenciaTarjetaDiv.innerHTML = `⚠️ Diferencia Tarjeta: ${diffTarjetaFormatted} € - Sobra dinero`;
        } else {
            diferenciaTarjetaDiv.className = 'diferencia negativo';
            diferenciaTarjetaDiv.innerHTML = `⚠️ Diferencia Tarjeta: ${diffTarjetaFormatted} € - Falta Dinero`;
        }
    }
    saveDraft();
}


// addMovimiento and removeMovimiento functions moved to modules/movimientos.js

function clearForm() {
    document.getElementById('cajaForm').reset();
    document.getElementById('fecha').value = getTodayString();
    appState.clearMovimientos();
    renderMovimientos(appState.getMovimientos());
    applySucursal();
    recalc();
    localStorage.removeItem('caja:draft');
    appState.setCurrentEditKey(null);
}

function loadFormData(data) {
    document.getElementById('fecha').value = data.fecha;
    if (data.sucursal) {
        localStorage.setItem('sucursal', data.sucursal);
        applySucursal();
    }
    document.getElementById('apertura').value = formatCurrency(data.apertura);
    document.getElementById('responsableApertura').value = data.responsableApertura;
    document.getElementById('ingresos').value = formatCurrency(data.ingresos);
    document.getElementById('ingresosTarjetaExora').value = formatCurrency(data.ingresosTarjetaExora || 0);
    document.getElementById('ingresosTarjetaDatafono').value = formatCurrency(data.ingresosTarjetaDatafono || 0);
    document.getElementById('cierre').value = formatCurrency(data.cierre);
    document.getElementById('responsableCierre').value = data.responsableCierre;

    appState.setMovimientos(data.movimientos || []);
    renderMovimientos(appState.getMovimientos());
    recalc();
}

async function saveDay() {
    const fecha = document.getElementById('fecha').value;
    const sucursal = localStorage.getItem('sucursal');
    const apertura = parseNum(document.getElementById('apertura').value);
    const responsableApertura = document.getElementById('responsableApertura').value.trim();
    const ingresos = parseNum(document.getElementById('ingresos').value);
    const ingresosTarjetaExora = parseNum(document.getElementById('ingresosTarjetaExora').value);
    const ingresosTarjetaDatafono = parseNum(document.getElementById('ingresosTarjetaDatafono').value);
    const cierre = parseNum(document.getElementById('cierre').value);
    const responsableCierre = document.getElementById('responsableCierre').value.trim();

    if (!fecha || !sucursal) {
        showAlert('Por favor, completa la fecha y sucursal', 'danger');
        return;
    }

    const isEmptyDay =
        apertura === 0 &&
        ingresos === 0 &&
        ingresosTarjetaExora === 0 &&
        ingresosTarjetaDatafono === 0 &&
        cierre === 0 &&
        appState.getMovimientos().length === 0;

    if (isEmptyDay) {
        showAlert('No hay datos para guardar', 'warning');
        return;
    }

    let sheetId;
    if (appState.getCurrentEditKey()) {
        const existing = loadDay(appState.getCurrentEditKey());
        sheetId = existing?.sheetId;
    }

    const dayData = {
        fecha,
        sucursal,
        apertura,
        responsableApertura,
        ingresos,
        ingresosTarjetaExora,
        ingresosTarjetaDatafono,
        movimientos: [...appState.getMovimientos()],
        cierre,
        responsableCierre,
        horaGuardado: new Date().toISOString(),
        sheetId
    };

    try {
        appState.setCurrentEditKey(saveDayData(fecha, dayData, appState.getCurrentEditKey()));

        // Enviar registro al backend para guardarlo/actualizarlo en Google Sheets
        const totals = computeTotals(apertura, ingresos, appState.getMovimientos(), cierre);
        const payload = {
            // Mantener la fecha en formato ISO (YYYY-MM-DD) evita
            // que Google Sheets interprete el valor como una fórmula
            // o como una fecha en otro formato regional.
            id: sheetId,
            fecha,
            // Se envía la hora con precisión de minutos para que sea
            // más consistente con las anotaciones realizadas manualmente.
            hora: new Date().toLocaleTimeString('es-ES', {
                hour: '2-digit',
                minute: '2-digit'
            }),
            sucursal,
            apertura,
            ingresos,
            tarjetaExora: ingresosTarjetaExora,
            tarjetaDatafono: ingresosTarjetaDatafono,
            dif: totals.diff,
            entradas: totals.entradas,
            salidas: totals.salidas,
            total: totals.total,
            cierre
        };

        try {
            const endpoint = sheetId ? '/api/update-record' : '/api/append-record';
            const resp = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await resp.json();
            if (!resp.ok) throw new Error(data.message || 'Error al crear registro');
            if (!sheetId && data.id) {
                sheetId = data.id;
                dayData.sheetId = sheetId;
                saveDayData(fecha, dayData, appState.getCurrentEditKey());
            }
            if (sheetId) {
                try {
                    await fetch('/api/append-tesoreria', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ cierreId: sheetId, fecha, movimientos: appState.getMovimientos() })
                    });
                } catch (err) {
                    console.error('No se pudo guardar movimientos en Tesorería', err);
                }
            }
        } catch (err) {
            console.error(err);
            showAlert('No se pudo guardar en Sheets', 'danger');
        }

        localStorage.removeItem('caja:draft');

        if (API_KEY && !isStaticHosting()) {
            const result = await apiRequest('/api/save-day', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: API_KEY
                },
                body: JSON.stringify({
                    cajaDiaria: { ...dayData, movimientos: undefined },
                    movimientos: appState.getMovimientos()
                })
            });

            if (result && result.success) {
                showAlert('Día guardado correctamente', 'success');
            } else if (result && result.mode === 'local') {
                showAlert('Día guardado localmente', 'info');
            } else {
                showAlert('Error al guardar el día en el servidor', 'danger');
            }
        } else {
            if (isStaticHosting()) {
                showAlert('Día guardado localmente (modo offline)', 'info');
            } else {
                showAlert('Día guardado localmente (sin API key)', 'info');
            }
        }

        renderHistorial(appState.getFilteredDates());
    } catch (error) {
        console.error('Error al guardar el día', error);
        showAlert('No se pudo guardar el día. Revisa la consola para más detalles', 'danger');
    }
}

function newDay() {
    clearForm();
    showAlert('Formulario limpiado para nuevo día', 'info');
}

async function deleteCurrentDay() {
    if (!appState.getCurrentEditKey()) {
        showAlert('No hay un día cargado para borrar', 'danger');
        return;
    }

    if (confirm(`¿Estás seguro de que quieres borrar el día ${formatDate(appState.getCurrentEditKey())}?`)) {
        await deleteDay(appState.getCurrentEditKey());
        clearForm();
        await renderHistorial(appState.getFilteredDates());
        showAlert(`Día ${formatDate(appState.getCurrentEditKey())} borrado correctamente`, 'success');
    }
}

async function deleteDayFromHistorial(id, fecha) {
    const index = getDayIndex();
    let key = id;

    if (!index.includes(id)) {
        key = index.find(k => {
            const data = loadDay(k);
            return String(data?.sheetId) === String(id);
        }) || null;
    }

    if (confirm(`¿Estás seguro de que quieres borrar el día ${formatDate(fecha)}?`)) {
        if (key) {
            await deleteDay(key);
            if (appState.getCurrentEditKey() === key) {
                clearForm();
            }
        } else {
            try {
                await fetch('/api/delete-record', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id })
                });
            } catch (err) {
                console.error('No se pudo borrar en Sheets', err);
            }
        }

        // Esperar un momento para que la eliminación se refleje en Google Sheets
        await new Promise(resolve => setTimeout(resolve, 1000));
        await renderHistorial(appState.getFilteredDates());
        showAlert(`Día ${formatDate(fecha)} borrado correctamente`, 'success');
    }
}

async function editDay(id) {
    const index = getDayIndex();
    let key = id;

    if (!index.includes(id)) {
        key = index.find(k => {
            const data = loadDay(k);
            return String(data?.sheetId) === String(id);
        }) || null;
    }

    let data = key ? loadDay(key) : null;

    if (!data) {
        try {
            const resp = await fetch(`/api/list-records?id=${id}`);
            const json = await resp.json().catch(() => ({}));
            const record = json.records && json.records[0];
            if (record) {
                data = {
                    fecha: record.fecha,
                    sucursal: record.sucursal,
                    apertura: record.apertura,
                    responsableApertura: '',
                    ingresos: record.ingresos,
                    ingresosTarjetaExora: record.tarjetaExora,
                    ingresosTarjetaDatafono: record.tarjetaDatafono,
                    movimientos: [],
                    cierre: record.cierre,
                    responsableCierre: '',
                    sheetId: record.id
                };
                key = saveDayData(record.fecha, data);
            }
        } catch (err) {
            console.error('No se pudo obtener de Sheets', err);
        }
    }

    if (data) {
        // Si no hay movimientos cargados, intenta obtenerlos de Tesorería
        const tesoreriaId = data.sheetId || (id && /^\d+$/.test(id) ? id : null);
        if ((!data.movimientos || !data.movimientos.length) && tesoreriaId) {
            try {
                const respMov = await fetch(`/api/list-tesoreria?id=${tesoreriaId}`);
                const jsonMov = await respMov.json().catch(() => ({}));
                if (Array.isArray(jsonMov.movimientos)) {
                    data.movimientos = jsonMov.movimientos;
                    if (key) {
                        saveDayData(key, data);
                    }
                }
            } catch (err) {
                console.error('No se pudieron cargar los movimientos de Tesorería', err);
            }
        }

        loadFormData(data);
        appState.setCurrentEditKey(key);
        showAlert(`Día ${formatDate(key)} cargado para edición`, 'info');
        // Hacer scroll hacia arriba para ver el formulario
        document.querySelector('.header').scrollIntoView({ behavior: 'smooth' });
    } else {
        showAlert('No se pudo cargar el día seleccionado', 'danger');
    }
}


// Filter functions moved to modules/filters.js

// Funciones de exportación
function generateCSVContent(data, headers) {
    const BOM = '\uFEFF';
    let content = BOM + headers.join(';') + '\n';
    
    data.forEach(row => {
        const csvRow = row.map(cell => {
            if (typeof cell === 'number') {
                return cell.toLocaleString('es-ES', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                });
            }
            return String(cell || '');
        });
        content += csvRow.join(';') + '\n';
    });
    
    return content;
}

function downloadFile(content, filename, mimeType = 'text/plain;charset=utf-8') {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function downloadDayCSV(date) {
    const dayData = loadDay(date);
    if (!dayData) {
        showAlert('Día no encontrado', 'danger');
        return;
    }

    const totals = computeTotals(dayData.apertura, dayData.ingresos, dayData.movimientos, dayData.cierre);
    const diferenciaTarjeta = (dayData.ingresosTarjetaDatafono || 0) - (dayData.ingresosTarjetaExora || 0);
    const cajaHeaders = [
        'Fecha', 'Hora', 'Sucursal', 'Apertura de caja (€)', 'Responsable apertura de caja',
        'Ingresos en efectivo (€)', 'Ingresos tarjeta (Exora)', 'Ingresos tarjeta (Datáfono)', 'Diferencia tarjeta (€)',
        'Gestión de tesorería (salidas)', 'Gestión de tesorería (entradas)',
        'Total en caja', 'Cierre de caja', 'Diferencia efectivo', 'Responsable de cierre de caja'
    ];
    const cajaData = [[
        formatDate(date.split('#')[0]),
        dayData.horaGuardado ? new Date(dayData.horaGuardado).toLocaleTimeString('es-ES') : '',
        dayData.sucursal,
        dayData.apertura,
        dayData.responsableApertura,
        dayData.ingresos,
        dayData.ingresosTarjetaExora || 0,
        dayData.ingresosTarjetaDatafono || 0,
        diferenciaTarjeta,
        totals.salidas,
        totals.entradas,
        totals.total,
        dayData.cierre,
        totals.diff,
        dayData.responsableCierre
    ]];

    let content = generateCSVContent(cajaData, cajaHeaders);
    content += '\n=== MOVIMIENTOS DE TESORERÍA ===\n';
    const movHeaders = ['Fecha', 'Tipo', 'Quién', 'Importe (€)'];
    content += movHeaders.join(';') + '\n';

    if (dayData.movimientos && dayData.movimientos.length > 0) {
        dayData.movimientos.forEach(mov => {
            const row = [
                formatDate(date.split('#')[0]),
                mov.tipo === 'entrada' ? 'Entrada' : 'Salida',
                mov.quien || 'No especificado',
                mov.importe || 0
            ].map(cell => {
                if (typeof cell === 'number') {
                    return cell.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                }
                return String(cell || '');
            }).join(';');
            content += row + '\n';
        });
    } else {
        content += 'No hay movimientos registrados\n';
    }

    const filename = `caja_${date.replace(/#/g, '_')}.csv`;
    downloadFile(content, filename, 'text/csv;charset=utf-8');
    showAlert(`Archivo ${filename} descargado`, 'success');
}

function emailDay(date) {
    const dayData = loadDay(date);
    if (!dayData) {
        showAlert('Día no encontrado', 'danger');
        return;
    }

    const {
        apertura,
        ingresos,
        movimientos = [],
        cierre,
        responsableApertura,
        responsableCierre,
        sucursal,
        ingresosTarjetaExora = 0,
        ingresosTarjetaDatafono = 0
    } = dayData;

    const totals = computeTotals(apertura, ingresos, movimientos, cierre);
    const diferenciaTarjeta = ingresosTarjetaDatafono - ingresosTarjetaExora;

    const emailTo = 'juanjo@labarberiadejuanjo.com';
    const emailSubject = `Resumen Caja LBJ - ${sucursal} - ${formatDate(date.split('#')[0])}`;
    const emailBody = `Hola Juanjo,\n\nRESUMEN DE CAJA LBJ\nFecha: ${formatDate(date.split('#')[0])}\nSucursal: ${sucursal}\n\n═══════════════════════════════════════\n\n1. APERTURA DE CAJA:\n   • Apertura: ${formatCurrency(apertura)} €\n   • Responsable: ${responsableApertura || 'No especificado'}\n\n2. INGRESOS EN EFECTIVO:\n   • Ingresos (Exora): ${formatCurrency(ingresos)} €\n\n3. GESTIÓN DE TESORERÍA:\n   • Total Entradas: ${formatCurrency(totals.entradas)} €\n   • Total Salidas: ${formatCurrency(totals.salidas)} €\n   ${movimientos.length > 0 ? '\n   Detalle movimientos:\n' + movimientos.map(mov => `   - ${mov.tipo === 'entrada' ? 'Entrada' : 'Salida'}: ${formatCurrency(mov.importe)} € (${mov.quien || 'No especificado'})`).join('\n') : '   • No hay movimientos registrados'}\n\n4. INGRESOS EN TARJETA:\n   • Ingresos tarjeta (Exora): ${formatCurrency(ingresosTarjetaExora)} €\n   • Ingresos tarjeta (Datáfono): ${formatCurrency(ingresosTarjetaDatafono)} €\n\n5. CIERRE DE CAJA:\n   • Cierre: ${formatCurrency(cierre)} €\n   • Responsable: ${responsableCierre || 'No especificado'}\n\n6. DIFERENCIAS:\n   • Diferencia Efectivo: ${formatCurrency(totals.diff)} € ${Math.abs(totals.diff) < 0.01 ? '✓ ¡Cuadra!' : (totals.diff > 0 ? '⚠ Sobra dinero' : '⚠ Falta Dinero')}\n   • Diferencia Tarjeta: ${formatCurrency(diferenciaTarjeta)} € ${Math.abs(diferenciaTarjeta) < 0.01 ? '✓ ¡Cuadra!' : (diferenciaTarjeta > 0 ? '⚠ Sobra dinero' : '⚠ Falta Dinero')}\n\n═══════════════════════════════════════\n\nSistema de Gestión de Caja LBJ\nGenerado automáticamente el ${formatDate(new Date().toISOString().split('T')[0])}`;

    sendEmail(emailTo, emailSubject, emailBody);
}

function computeResumenData(filter) {
    let dates = getDayIndex();
    if (filter) {
        dates = dates.filter(date => {
            const day = date.split('#')[0];
            return day >= filter.desde && day <= filter.hasta;
        });
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
    const rows = [];
    const totals = { apertura: 0, ingresos: 0, entradas: 0, salidas: 0, total: 0, cierre: 0, diff: 0 };

    days.forEach(day => {
        const sums = summary[day];
        totals.apertura += sums.apertura;
        totals.ingresos += sums.ingresos;
        totals.entradas += sums.entradas;
        totals.salidas += sums.salidas;
        totals.total += sums.total;
        totals.cierre += sums.cierre;
        totals.diff += sums.diff;
        rows.push({ day, ...sums });
    });

    return { rows, totals };
}

function downloadResumenCSV() {
    const { rows, totals } = computeResumenData(appState.getFilteredDates());
    if (!rows.length) {
        showAlert('No hay datos para exportar', 'danger');
        return;
    }

    const headers = ['Fecha', 'Apertura (€)', 'Ingresos (€)', 'Entradas (€)', 'Salidas (€)', 'Total (€)', 'Cierre (€)', 'Dif. (€)'];
    const data = rows.map(r => [
        formatDate(r.day),
        r.apertura,
        r.ingresos,
        r.entradas,
        r.salidas,
        r.total,
        r.cierre,
        r.diff
    ]);
    data.push(['Total', totals.apertura, totals.ingresos, totals.entradas, totals.salidas, totals.total, totals.cierre, totals.diff]);

    const content = generateCSVContent(data, headers);
    const filename = appState.getFilteredDates()
        ? `resumen_${appState.getFilteredDates().desde}_${appState.getFilteredDates().hasta}.csv`
        : 'resumen_completo.csv';
    downloadFile(content, filename, 'text/csv;charset=utf-8');
    showAlert(`Archivo ${filename} descargado`, 'success');
}

function emailResumen() {
    const { rows, totals } = computeResumenData(appState.getFilteredDates());
    if (!rows.length) {
        showAlert('No hay datos para enviar', 'danger');
        return;
    }

    const rango = appState.getFilteredDates()
        ? `${formatDate(appState.getFilteredDates().desde)} - ${formatDate(appState.getFilteredDates().hasta)}`
        : 'Todos los registros';

    let body = `Hola Juanjo,\n\nRESUMEN DE FACTURACIÓN\n${rango}\n\n`;
    rows.forEach(r => {
        body += `${formatDate(r.day)}: A ${formatCurrency(r.apertura)} €, In ${formatCurrency(r.ingresos)} €, Ent ${formatCurrency(r.entradas)} €, Sal ${formatCurrency(r.salidas)} €, Tot ${formatCurrency(r.total)} €, Cie ${formatCurrency(r.cierre)} €, Dif ${formatCurrency(r.diff)} €\n`;
    });
    body += `\nTotales:\n - Apertura: ${formatCurrency(totals.apertura)} €\n - Ingresos: ${formatCurrency(totals.ingresos)} €\n - Entradas: ${formatCurrency(totals.entradas)} €\n - Salidas: ${formatCurrency(totals.salidas)} €\n - Total: ${formatCurrency(totals.total)} €\n - Cierre: ${formatCurrency(totals.cierre)} €\n - Dif.: ${formatCurrency(totals.diff)} €\n\nSistema de Gestión de Caja LBJ`;

    const emailTo = 'juanjo@labarberiadejuanjo.com';
    const subject = `Resumen de Facturación LBJ - ${rango}`;
    sendEmail(emailTo, subject, body);
}

function sendEmail(emailTo, emailSubject, emailBody) {
    try {
        // Crear enlace mailto
        const mailtoLink = `mailto:${emailTo}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;
        
        // Crear un enlace temporal y hacer click
        const tempLink = document.createElement('a');
        tempLink.href = mailtoLink;
        tempLink.style.display = 'none';
        document.body.appendChild(tempLink);
        tempLink.click();
        document.body.removeChild(tempLink);
        
        if (appState.getFilteredDates()) {
            showAlert(`Email consolidado preparado para el período ${formatDate(appState.getFilteredDates().desde)} - ${formatDate(appState.getFilteredDates().hasta)}`, 'success');
        } else {
            showAlert(`Email preparado para enviar a ${emailTo}`, 'success');
        }
    } catch (error) {
        showAlert('No se pudo abrir el cliente de email automáticamente', 'danger');
    }
}

function closeAllActionsMenus() {
    document
        .querySelectorAll('.dropdown-menu.show')
        .forEach(menu => {
            menu.classList.remove('show');
            menu.style.top = '';
            menu.style.bottom = '';
        });
}

function toggleActionsMenu(id) {
    const menu = document.getElementById(id);
    if (menu) {
        const isOpen = menu.classList.contains('show');
        closeAllActionsMenus();
        if (!isOpen) {
            menu.classList.add('show');
            const rect = menu.getBoundingClientRect();
            if (rect.bottom > window.innerHeight) {
                menu.style.top = 'auto';
                menu.style.bottom = '100%';
            } else {
                menu.style.top = '';
                menu.style.bottom = '';
            }
        }
    }
}

// Funciones de testing
function runTests() {
    const tests = [
        {
            name: 'Test 1: Cálculo básico sin movimientos',
            test: () => {
                const result = computeTotals(100, 50, [], 120);
                return result.entradas === 0 &&
                       result.salidas === 0 &&
                       result.total === 150 &&
                       result.diff === -30;
            }
        },
        {
            name: 'Test 2: Cálculo con movimientos variados',
            test: () => {
                const movimientos = [
                    {tipo:'entrada', importe:20},
                    {tipo:'salida', importe:10},
                    {tipo:'entrada', importe:5}
                ];
                const result = computeTotals(0, 100, movimientos, 115);
                return result.entradas === 25 && 
                       result.salidas === 10 && 
                       result.total === 115 && 
                       result.diff === 0;
            }
        },
        {
            name: 'Test 3: Datos sucios y parseNum',
            test: () => {
                const movimientos = [
                    {tipo:'entrada', importe:'10,50 €'},
                    {tipo:'salida', importe:'2.000,50'},
                    {tipo:'salida'} // Sin importe
                ];
                const result = computeTotals('1.000,00', '200,00', movimientos, ' -800,00 ');
                return result.entradas === 10.5 && 
                       result.salidas === 2000.5 && 
                       Math.round(result.total) === -790;
            }
        },
        {
            name: 'Test 4: Filtro por fechas',
            test: () => {
                const mockIndex = ['2025-08-01', '2025-08-10', '2025-08-20'];
                const desde = '2025-08-05';
                const hasta = '2025-08-15';
                const filtered = mockIndex.filter(date => date >= desde && date <= hasta);
                return filtered.length === 1 && filtered[0] === '2025-08-10';
            }
        },
        { 
            name: 'Test 5: Delete day functionality',
            test: () => {
                // Guardar un día de prueba
                const testDate = '2025-08-16';
                const testData = { fecha: testDate, sucursal: 'Test', apertura: 100 };
                const key = saveDayData(testDate, testData);

                // Verificar que está en el índice
                let index = getDayIndex();
                const wasInIndex = index.includes(key);

                // Eliminar
                deleteDay(key);

                // Verificar que se eliminó
                index = getDayIndex();
                const isStillInIndex = index.includes(key);
                const dataExists = loadDay(key) !== null;

                return wasInIndex && !isStillInIndex && !dataExists;
            }
        }
    ];
    
    const results = tests.map(test => {
        try {
            const passed = test.test();
            console.log(`✅ ${test.name}: ${passed ? 'PASS' : 'FAIL'}`);
            return { name: test.name, passed, error: null };
        } catch (error) {
            console.error(`❌ ${test.name}: ERROR - ${error.message}`);
            return { name: test.name, passed: false, error: error.message };
        }
    });
    
    displayTestResults(results);
}



// Event listeners y inicialización
document.addEventListener('DOMContentLoaded', function() {
    // Configurar fecha por defecto
    document.getElementById('fecha').value = getTodayString();
    initializeSucursal();
    updateResponsables();

    // Event listeners para recálculo automático
    ['apertura', 'ingresos', 'ingresosTarjetaExora', 'ingresosTarjetaDatafono', 'cierre'].forEach(id => {
        const element = document.getElementById(id);
        element.addEventListener('input', recalc);
        element.addEventListener('blur', function() {
            this.value = formatCurrency(this.value);
        });
        element.addEventListener('focus', function() {
            if (parseNum(this.value) === 0) {
                this.value = '';
            }
        });
    });

    ['responsableApertura', 'responsableCierre'].forEach(id => {
        const element = document.getElementById(id);
        element.addEventListener('input', saveDraft);
    });
    
    // Event listener para cambio de fecha
    document.getElementById('fecha').addEventListener('change', function() {
        const selectedDate = this.value;
        const matches = getDayIndex().filter(d => d.startsWith(selectedDate));

        if (matches.length === 1) {
            const existingData = loadDay(matches[0]);
            loadFormData(existingData);
            appState.setCurrentEditKey(matches[0]);
            showAlert('Día cargado desde el historial', 'info');
        } else if (matches.length > 1) {
            const currentDate = this.value;
            clearForm();
            this.value = currentDate;
            showAlert('Existen múltiples cierres para esta fecha, usa el historial para seleccionar uno', 'warning');
        } else {
            const currentDate = this.value;
            clearForm();
            this.value = currentDate;
        }
        saveDraft();
    });
    
    // Event listener para Enter en el formulario de movimientos
    document.getElementById('importeMovimiento').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            addMovimiento();
        }
    });

    // Limpiar importe si es 0 al enfocar
    document.getElementById('importeMovimiento').addEventListener('focus', function() {
        if (parseNum(this.value) === 0) {
            this.value = '';
        }
    });

    // Formatear campos de moneda al perder el foco
    document.getElementById('importeMovimiento').addEventListener('blur', function() {
        if (this.value) {
            this.value = formatCurrency(this.value);
        }
    });
    
    // Delegación de eventos para botones del historial
    document.getElementById('historialTable').addEventListener('click', function(e) {
        if (e.target.matches('.btn')) {
            e.preventDefault();
            // Los onclick ya están manejados en el HTML generado
        }
    });
    
    // Inicializar UI
    loadDraft();
    renderMovimientos(appState.getMovimientos());
    filterToday(true);
    recalc();
    
    console.log('📊 Sistema de Caja LBJ inicializado correctamente');
});

// Make functions globally available for HTML onclick handlers
window.newDay = newDay;
window.saveDay = saveDay;
window.deleteCurrentDay = deleteCurrentDay;
window.handleSucursalSave = handleSucursalSave;
window.changeSucursal = changeSucursal;
window.displayTestResults = displayTestResults;
window.hideTests = hideTests;
window.filterToday = filterToday;
window.filterThisWeek = filterThisWeek;
window.filterThisMonth = filterThisMonth;
window.applyDateFilter = applyDateFilter;
window.clearDateFilter = clearDateFilter;
window.emailResumen = emailResumen;
window.downloadResumenCSV = downloadResumenCSV;
// window.editRecord = editRecord; // Function not found, removed
window.addMovimiento = addMovimiento;
window.removeMovimiento = removeMovimiento;
window.runTests = runTests;
window.editDay = editDay;
window.deleteDayFromHistorial = deleteDayFromHistorial;
window.loadDraft = loadDraft;
window.downloadDayCSV = downloadDayCSV;
window.emailDay = emailDay;
window.toggleActionsMenu = toggleActionsMenu;
window.closeAllActionsMenus = closeAllActionsMenus;
window.recalc = recalc;

// API integration utilities (legacy)
function legacySafeNum(v) {
    return Number(v) || 0;
}

function buildPayloadFromForm() {
    const getVal = (id) => {
        const el = document.getElementById(id);
        if (!el) {
            console.warn(`Elemento ${id} no encontrado`);
            return '';
        }
        return el.value;
    };

    return {
        fecha: getVal('fecha'),
        hora: getVal('hora'),
        sucursal: getVal('sucursal'),
        apertura: getVal('apertura'),
        ingresos: getVal('ingresos'),
        tarjetaExora: getVal('ingresosTarjetaExora'),
        tarjetaDatafono: getVal('ingresosTarjetaDatafono'),
        dif: getVal('dif'),
        entradas: getVal('entradas'),
        salidas: getVal('salidas'),
        total: getVal('total'),
        cierre: getVal('cierre')
    };
}

async function createRecord() {
    const payload = buildPayloadFromForm();
    try {
        const resp = await fetch('/api/append-record', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok) {
            alert(data.message || 'Error al crear registro');
            return null;
        }
        const id = data.id;
        const hidden = document.getElementById('registroId');
        if (hidden) {
            hidden.value = id;
        } else {
            localStorage.setItem('ultimoID', id);
        }
        return data;
    } catch (err) {
        console.error(err);
        alert(err.message);
        return null;
    }
}

async function updateRecord(id) {
    const payload = { id, ...buildPayloadFromForm() };
    try {
        const resp = await fetch('/api/update-record', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok) {
            alert(data.message || 'Error al actualizar registro');
            return null;
        }
        return data;
    } catch (err) {
        console.error(err);
        alert(err.message);
        return null;
    }
}

async function deleteRecord(id) {
    try {
        const resp = await fetch('/api/delete-record', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id })
        });
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok) {
            alert(data.message || 'Error al borrar registro');
            return null;
        }
        return data;
    } catch (err) {
        console.error(err);
        alert(err.message);
        return null;
    }
}

function wireUI() {
    const getId = () => document.getElementById('registroId')?.value || localStorage.getItem('ultimoID');

    const btnGuardar = document.getElementById('btnGuardar');
    if (btnGuardar) {
        btnGuardar.addEventListener('click', async () => {
            btnGuardar.disabled = true;
            try {
                await createRecord();
            } catch (err) {
                console.error(err);
            } finally {
                btnGuardar.disabled = false;
            }
        });
    }

    const btnEditar = document.getElementById('btnEditar');
    if (btnEditar) {
        btnEditar.addEventListener('click', async () => {
            const id = getId();
            if (!id) {
                alert('ID no disponible');
                return;
            }
            btnEditar.disabled = true;
            try {
                await updateRecord(id);
            } catch (err) {
                console.error(err);
            } finally {
                btnEditar.disabled = false;
            }
        });
    }

    const btnBorrar = document.getElementById('btnBorrar');
    if (btnBorrar) {
        btnBorrar.addEventListener('click', async () => {
            const id = getId();
            if (!id) {
                alert('ID no disponible');
                return;
            }
            btnBorrar.disabled = true;
            try {
                await deleteRecord(id);
            } catch (err) {
                console.error(err);
            } finally {
                btnBorrar.disabled = false;
            }
        });
    }
}

document.addEventListener('DOMContentLoaded', wireUI);

window.API = { createRecord, updateRecord, deleteRecord };

// === Teclados iPad + normalización numérica ===
function safeNum(v){ const n = Number(v); return Number.isFinite(n) ? n : 0; }
function normMoneyStr(v) {
  if (typeof v !== 'string') v = String(v ?? '');
  v = v.trim();
  // Quitar separadores de miles (.) y usar punto para decimales
  v = v.replace(/\./g, '').replace(',', '.');
  return v;
}
function parseMoney(v) {
  const n = Number(normMoneyStr(v));
  return Number.isFinite(n) ? n : 0;
}

// Restringir caracteres mientras se escribe
function wireNumericKeyboards(){
  // Solo dígitos
  document.querySelectorAll('input[inputmode="numeric"]').forEach(el => {
    el.addEventListener('input', () => {
      el.value = el.value.replace(/\D+/g, '');
    });
  });
  // Decimales: dígitos + un separador (coma o punto)
  document.querySelectorAll('input[inputmode="decimal"]').forEach(el => {
    el.addEventListener('input', () => {
      el.value = el.value
        .replace(/[^0-9,\.]/g, '')
        .replace(/([,\.]).*?\1/g, '$1'); // solo un separador
    });
  });
}

// Si ya existe buildPayloadFromForm, ACTUALÍZALA; si no, créala con este contenido:
if (typeof buildPayloadFromForm !== 'function') {
  window.buildPayloadFromForm = function buildPayloadFromForm(){
    const v = (sel) => document.querySelector(sel)?.value ?? '';
    return {
      fecha:       v('#fecha'),
      hora:        v('#hora'),
      sucursal:    v('#sucursal'),
      apertura:    parseMoney(v('#apertura')),
      ingresos:    parseMoney(v('#ingresos')),
      tarjetaExora:    parseMoney(v('#tx')),
      tarjetaDatafono: parseMoney(v('#td')),
      dif:         parseMoney(v('#dif')),
      entradas:    safeNum(v('#entradas')),
      salidas:     safeNum(v('#salidas')),
      total:       parseMoney(v('#total')),
      cierre:      parseMoney(v('#cierre')),
    };
  };
} else {
  // En caso de existir, envuelve su retorno aplicando parseMoney / safeNum a los campos indicados
  const _orig = buildPayloadFromForm;
  window.buildPayloadFromForm = function(){
    const p = _orig() || {};
    p.apertura       = parseMoney(p.apertura);
    p.ingresos       = parseMoney(p.ingresos);
    p.tarjetaExora   = parseMoney(p.tarjetaExora ?? p.tx);
    p.tarjetaDatafono= parseMoney(p.tarjetaDatafono ?? p.td);
    p.dif            = parseMoney(p.dif);
    p.entradas       = safeNum(p.entradas);
    p.salidas        = safeNum(p.salidas);
    p.total          = parseMoney(p.total);
    p.cierre         = parseMoney(p.cierre);
    return p;
  };
}

// Ejecuta el cableado (sin romper wireUI existentes)
if (typeof document !== 'undefined') {
    try { wireNumericKeyboards(); } catch(e) { console.warn('wireNumericKeyboards()', e); }
}

// === Keypad numérico para iPad (mini-calculadora) ===
const isIPad = /iPad/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

(function initNumPad(){
  if (!isIPad) return; // en iPhone/desktop no se activa; usan teclado nativo
  let activeInput = null;
  let pad = null;

  function isZeroish(v) {
    if (typeof v !== 'string') v = String(v ?? '');
    v = v.trim();
    return v === '' || v === '0' || v === '0,' || v === '0.' ||
           v === '0,0' || v === '0.0' || v === '0,00' || v === '0.00';
  }

  function buildPad(){
    pad = document.createElement('div');
    pad.className = 'numpad hidden';
    pad.innerHTML = `
      <div class="numpad-grid">
        <button data-k="7">7</button><button data-k="8">8</button><button data-k="9">9</button><button class="del" data-k="back">⌫</button>
        <button data-k="4">4</button><button data-k="5">5</button><button data-k="6">6</button><button data-k="clear">C</button>
        <button data-k="1">1</button><button data-k="2">2</button><button data-k="3">3</button><button class="ok" data-k="ok">OK</button>
        <button class="wide" data-k="0">0</button><button data-k="sep">,</button><button data-k="minus">±</button>
      </div>`;
    document.body.appendChild(pad);

    const pointerEvt = window.PointerEvent ? 'pointerdown' : 'touchstart';
    pad.addEventListener(pointerEvt, (e) => {
      const b = e.target.closest('button');
      if (!b || !activeInput) return;
      // Evitar retrasos y dobles disparos
      e.preventDefault();
      e.stopPropagation();

      const kind = b.getAttribute('data-k');
      const mode = activeInput.dataset.numpad || 'decimal';
      let v = activeInput.value || '';
      const set = (nv) => { activeInput.value = nv; };

      switch (kind) {
        case 'ok':
          hidePad();
          activeInput.dispatchEvent(new Event('change', { bubbles: true }));
          break;
        case 'back':
          set(v.slice(0, -1));
          break;
        case 'clear':
          set('');
          break;
        case 'sep':
          if (mode !== 'int' && !v.includes(',') && !v.includes('.')) set(v + ',');
          break;
        case 'minus':
          if (mode === 'int' || mode === 'decimal') set(v.startsWith('-') ? v.slice(1) : ('-' + v));
          break;
        default: // dígitos 0-9
          set(isZeroish(v) ? kind : (v + kind));
      }
    });
  }

  function showPad(input){
    if (!pad) buildPad();
    activeInput = input;
    document.body.classList.add('numpad-open');
    pad.classList.remove('hidden');
    if (typeof isZeroish === 'function' && isZeroish(input.value)) input.value = '';
  }
  function hidePad(){
    activeInput = null;
    if (pad) pad.classList.add('hidden');
    document.body.classList.remove('numpad-open');
  }

  // Preparar inputs con data-numpad
  document.querySelectorAll('input[data-numpad]').forEach(inp=>{
    inp.setAttribute('readonly', 'readonly');   // evita teclado del sistema en iPad
    inp.addEventListener('focus', ()=> showPad(inp));
    inp.addEventListener('click', ()=> showPad(inp));
  });

  // Cerrar al tocar fuera
  document.addEventListener('click', (e)=>{
    if (!pad || pad.classList.contains('hidden')) return;
    if (e.target.closest('.numpad') || e.target.closest('input[data-numpad]')) return;
    hidePad();
  });
  // Cerrar con Escape (si hay teclado hardware)
  document.addEventListener('keydown', (e)=> { if (e.key === 'Escape') hidePad(); });
})();

// Normalizador de dinero (opcional, por si no existe ya)
if (typeof parseMoney !== 'function') {
  window.parseMoney = function parseMoney(v) {
    if (typeof v !== 'string') v = String(v ?? '');
    v = v.trim().replace(/\./g, '').replace(',', '.');
    const n = Number(v); return Number.isFinite(n) ? n : 0;
  }
}

// Bloquear doble-tap zoom y pinch en iOS/PWA
document.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false });
let lastTouchEnd = 0;
document.addEventListener('touchend', (e) => {
  // No bloquear dentro del keypad para permitir toques rápidos
  if (e.target.closest && e.target.closest('.numpad')) {
    lastTouchEnd = Date.now();
    return;
  }
  const now = Date.now();
  if (now - lastTouchEnd <= 300) {
    e.preventDefault(); // bloquea doble-tap zoom fuera del keypad
  }
  lastTouchEnd = now;
}, { passive: false });
document.addEventListener('gesturestart', (e) => e.preventDefault(), { passive: false });
document.addEventListener('gesturechange', (e) => e.preventDefault(), { passive: false });
document.addEventListener('gestureend', (e) => e.preventDefault(), { passive: false });
