import { parseNum, formatCurrency, formatDate, getTodayString, computeTotals } from "./utils/index.js";
import { getDayIndex, loadDay, saveDayData, deleteDay, saveToLocalStorage, getFromLocalStorage } from "./storage.js";
import { renderMovimientos, renderHistorial, showAlert, displayTestResults, hideTests } from "./ui.js";

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
if ('serviceWorker' in navigator) {
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

// Variables globales
let currentMovimientos = [];
let filteredDates = null;
let currentEditKey = null;
const API_KEY = globalThis.API_KEY || '';

const empleadosPorSucursal = {
    "Lliçà d'Amunt": ["Juanjo", "Jordi", "Ian Paul", "Miquel"],
    "Parets del Vallès": ["Juanjo", "Quim", "Genís", "Alex"]
};

function setActiveChip(id) {
    document.querySelectorAll('.chip').forEach(chip => {
        chip.classList.toggle('active', chip.id === id);
    });
}

function updateResponsables() {
    const sucursal = localStorage.getItem('sucursal');
    const nombres = empleadosPorSucursal[sucursal] || [];
    const placeholders = {
        responsableApertura: 'Seleccionar responsable',
        responsableCierre: 'Seleccionar responsable',
        quienMovimiento: 'Quién realizó'
    };
    ['responsableApertura', 'responsableCierre', 'quienMovimiento'].forEach(id => {
        const select = document.getElementById(id);
        if (!select) return;
        const current = select.value;
        select.innerHTML = `<option value="">${placeholders[id]}</option>` +
            nombres.map(nombre => `<option value="${nombre}">${nombre}</option>`).join('');
        if (nombres.includes(current)) {
            select.value = current;
        }
    });
}

function applySucursal() {
    const saved = localStorage.getItem('sucursal');
    const display = document.getElementById('currentSucursal');
    if (display) {
        display.textContent = saved || '';
    }
    updateResponsables();
}

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
        movimientos: [...currentMovimientos],
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
    const apertura = parseFloat(document.getElementById('apertura').value) || 0;
    const ingresos = parseFloat(document.getElementById('ingresos').value) || 0;
    const cierre = parseFloat(document.getElementById('cierre').value) || 0;
    
    const totals = computeTotals(apertura, ingresos, currentMovimientos, cierre);

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

    // Si falta dinero, intenta enviar una alerta solo si hay API_KEY
    if (totals.diff < 0 && API_KEY) {
        const alertData = {
            sucursal: localStorage.getItem('sucursal'),
            fecha: document.getElementById('fecha').value,
            diferencia: totals.diff,
            detalle: currentMovimientos
                .map(m => `${m.tipo} - ${m.quien}: ${formatCurrency(m.importe)} €`)
                .join('\n')
        };
        fetch('/api/send-alert', {
            method: 'POST',
            body: JSON.stringify(alertData),
            headers: {
                'Content-Type': 'application/json',
                'Authorization': API_KEY
            }
        })
            .then(response => {
                if (response.ok) {
                    showAlert(`Alerta enviada (${response.status})`, 'success');
                } else {
                    showAlert(`No se pudo enviar la alerta (${response.status})`, 'danger');
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
    
    // Actualizar dashboard
    updateDashboard();
    saveDraft();
}

function updateDashboard() {
    const apertura = parseFloat(document.getElementById('apertura').value) || 0;
    const ingresos = parseFloat(document.getElementById('ingresos').value) || 0;
    const ingresosTarjetaExora = parseFloat(document.getElementById('ingresosTarjetaExora').value) || 0;
    const ingresosTarjetaDatafono = parseFloat(document.getElementById('ingresosTarjetaDatafono').value) || 0;
    const cierre = parseFloat(document.getElementById('cierre').value) || 0;
    
    // Calcular totales
    const totals = computeTotals(apertura, ingresos, currentMovimientos, cierre);
    
    // Total ingresos = efectivo + tarjetas de Exora
    const totalIngresos = ingresos + ingresosTarjetaExora;
    
    // Diferencia efectivo = (apertura + ingresos + entradas - salidas) - cierre
    const diferenciaEfectivo = totals.diff;
    
    // Diferencia tarjeta = Datáfono - Exora
    const diferenciaTarjeta = ingresosTarjetaDatafono - ingresosTarjetaExora;
    
    // Actualizar elementos del dashboard con animación suave
    const totalIngresosEl = document.getElementById('totalIngresosHoy');
    const diferenciaEfectivoEl = document.getElementById('diferenciaEfectivoHoy');
    const diferenciaTarjetaEl = document.getElementById('diferenciaTarjetaHoy');
    
    if (totalIngresosEl) {
        const newValue = formatCurrency(totalIngresos) + ' €';
        if (totalIngresosEl.textContent !== newValue) {
            totalIngresosEl.style.opacity = '0.7';
            totalIngresosEl.textContent = newValue;
            setTimeout(() => { totalIngresosEl.style.opacity = '1'; }, 100);
        }
    }
    
    if (diferenciaEfectivoEl) {
        const newValue = formatCurrency(diferenciaEfectivo) + ' €';
        if (diferenciaEfectivoEl.textContent !== newValue) {
            diferenciaEfectivoEl.style.opacity = '0.7';
            diferenciaEfectivoEl.textContent = newValue;
            setTimeout(() => { diferenciaEfectivoEl.style.opacity = '1'; }, 100);
        }
        
        // Cambiar color según la diferencia
        const card = diferenciaEfectivoEl.closest('.summary-card');
        if (card) {
            card.classList.remove('positive', 'negative', 'neutral');
            if (Math.abs(diferenciaEfectivo) < 0.01) {
                card.classList.add('neutral');
            } else if (diferenciaEfectivo > 0) {
                card.classList.add('positive');
            } else {
                card.classList.add('negative');
            }
        }
    }
    
    if (diferenciaTarjetaEl) {
        const newValue = formatCurrency(diferenciaTarjeta) + ' €';
        if (diferenciaTarjetaEl.textContent !== newValue) {
            diferenciaTarjetaEl.style.opacity = '0.7';
            diferenciaTarjetaEl.textContent = newValue;
            setTimeout(() => { diferenciaTarjetaEl.style.opacity = '1'; }, 100);
        }
        
        // Cambiar color según la diferencia
        const card = diferenciaTarjetaEl.closest('.summary-card');
        if (card) {
            card.classList.remove('positive', 'negative', 'neutral');
            if (Math.abs(diferenciaTarjeta) < 0.01) {
                card.classList.add('neutral');
            } else if (diferenciaTarjeta > 0) {
                card.classList.add('positive');
            } else {
                card.classList.add('negative');
            }
        }
    }
}


function tryAddMovimiento() {
    const importe = parseFloat(document.getElementById('importeMovimiento').value) || 0;
    
    // Solo agregar si hay un importe válido y mayor que 0
    if (importe > 0) {
        addMovimiento();
    }
}

function addMovimiento() {
    const tipo = document.getElementById('tipoMovimiento').value;
    const quien = document.getElementById('quienMovimiento').value.trim();
    const importe = parseFloat(document.getElementById('importeMovimiento').value) || 0;
    
    if (importe === 0) {
        showAlert('Por favor, introduce un importe válido', 'danger');
        return;
    }
    
    if (importe < 0) {
        showAlert('El importe no puede ser negativo', 'danger');
        return;
    }
    
    currentMovimientos.push({
        tipo,
        quien: quien || 'No especificado',
        importe: importe
    });
    
    // Limpiar formulario de movimiento
    document.getElementById('quienMovimiento').value = '';
    document.getElementById('importeMovimiento').value = '';
    
    renderMovimientos(currentMovimientos);
    recalc();
}

function removeMovimiento(index) {
    currentMovimientos.splice(index, 1);
    renderMovimientos(currentMovimientos);
    recalc();
}

function clearForm() {
    document.getElementById('cajaForm').reset();
    document.getElementById('fecha').value = getTodayString();
    currentMovimientos = [];
    renderMovimientos(currentMovimientos);
    applySucursal();
    recalc();
    localStorage.removeItem('caja:draft');
    currentEditKey = null;
}

function loadFormData(data) {
    document.getElementById('fecha').value = data.fecha;
    if (data.sucursal) {
        localStorage.setItem('sucursal', data.sucursal);
        applySucursal();
    }
    // Para campos type="number", usar valores numéricos directos
    document.getElementById('apertura').value = parseNum(data.apertura).toFixed(2);
    document.getElementById('responsableApertura').value = data.responsableApertura;
    document.getElementById('ingresos').value = parseNum(data.ingresos).toFixed(2);
    document.getElementById('ingresosTarjetaExora').value = parseNum(data.ingresosTarjetaExora || 0).toFixed(2);
    document.getElementById('ingresosTarjetaDatafono').value = parseNum(data.ingresosTarjetaDatafono || 0).toFixed(2);
    document.getElementById('cierre').value = parseNum(data.cierre).toFixed(2);
    document.getElementById('responsableCierre').value = data.responsableCierre;
    
    // Actualizar visualización de € para todos los campos cargados
    ['apertura', 'ingresos', 'ingresosTarjetaExora', 'ingresosTarjetaDatafono', 'cierre'].forEach(id => {
        const element = document.getElementById(id);
        const value = parseFloat(element.value);
        if (!isNaN(value) && value > 0) {
            updateCurrencyDisplay(element, value);
        }
    });

    currentMovimientos = data.movimientos || [];
    renderMovimientos(currentMovimientos);
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
        currentMovimientos.length === 0;

    if (isEmptyDay) {
        showAlert('No hay datos para guardar', 'warning');
        return;
    }

    let sheetId;
    if (currentEditKey) {
        const existing = loadDay(currentEditKey);
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
        movimientos: [...currentMovimientos],
        cierre,
        responsableCierre,
        horaGuardado: new Date().toISOString(),
        sheetId
    };

    try {
        currentEditKey = saveDayData(fecha, dayData, currentEditKey);

        // Enviar registro al backend para guardarlo/actualizarlo en Google Sheets
        const totals = computeTotals(apertura, ingresos, currentMovimientos, cierre);
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
                saveDayData(fecha, dayData, currentEditKey);
            }
            if (sheetId) {
                try {
                    await fetch('/api/append-tesoreria', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ cierreId: sheetId, fecha, movimientos: currentMovimientos })
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

        if (API_KEY) {
            const response = await fetch('/api/save-day', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: API_KEY
                },
                body: JSON.stringify({
                    cajaDiaria: { ...dayData, movimientos: undefined },
                    movimientos: currentMovimientos
                })
            });

            const result = await response.json();

            if (result.success) {
                showAlert('Día guardado correctamente', 'success');
            } else {
                showAlert('Error al guardar el día en el servidor', 'danger');
            }
        } else {
            showAlert('Día guardado localmente (sin API key)', 'info');
        }

        renderHistorial(filteredDates);
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
    if (!currentEditKey) {
        showAlert('No hay un día cargado para borrar', 'danger');
        return;
    }

    if (confirm(`¿Estás seguro de que quieres borrar el día ${formatDate(currentEditKey)}?`)) {
        await deleteDay(currentEditKey);
        clearForm();
        await renderHistorial(filteredDates);
        showAlert(`Día ${formatDate(currentEditKey)} borrado correctamente`, 'success');
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
            if (currentEditKey === key) {
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
        await renderHistorial(filteredDates);
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
        currentEditKey = key;
        showAlert(`Día ${formatDate(key)} cargado para edición`, 'info');
        // Hacer scroll hacia arriba para ver el formulario
        document.querySelector('.header').scrollIntoView({ behavior: 'smooth' });
    } else {
        showAlert('No se pudo cargar el día seleccionado', 'danger');
    }
}


// Funciones de filtrado
function filterToday(silent = false) {
    const today = new Date();
    const todayStr = new Date(today.getTime() - today.getTimezoneOffset() * 60000)
        .toISOString()
        .split('T')[0];
    document.getElementById('fechaDesde').value = todayStr;
    document.getElementById('fechaHasta').value = todayStr;
    applyDateFilter(silent);
    setActiveChip('chipToday');
}

function filterThisWeek() {
    const today = new Date();

    // Calcular inicio de semana (lunes)
    const dayOfWeek = today.getDay(); // 0 = domingo, 1 = lunes, etc.
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Si es domingo, retroceder 6 días

    const monday = new Date(today);
    monday.setDate(today.getDate() + mondayOffset);

    // Calcular fin de semana (domingo)
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    const mondayStr = new Date(monday.getTime() - monday.getTimezoneOffset() * 60000)
        .toISOString()
        .split('T')[0];
    const sundayStr = new Date(sunday.getTime() - sunday.getTimezoneOffset() * 60000)
        .toISOString()
        .split('T')[0];

    document.getElementById('fechaDesde').value = mondayStr;
    document.getElementById('fechaHasta').value = sundayStr;
    applyDateFilter();
    setActiveChip('chipWeek');
}

function filterThisMonth() {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth(); // 0-11

    // Primer día del mes
    const firstDay = new Date(year, month, 1);

    // Último día del mes
    const lastDay = new Date(year, month + 1, 0);

    const firstDayStr = new Date(firstDay.getTime() - firstDay.getTimezoneOffset() * 60000)
        .toISOString()
        .split('T')[0];
    const lastDayStr = new Date(lastDay.getTime() - lastDay.getTimezoneOffset() * 60000)
        .toISOString()
        .split('T')[0];

    document.getElementById('fechaDesde').value = firstDayStr;
    document.getElementById('fechaHasta').value = lastDayStr;
    applyDateFilter();
    setActiveChip('chipMonth');
}

function applyDateFilter(silent = false) {
    const desde = document.getElementById('fechaDesde').value;
    const hasta = document.getElementById('fechaHasta').value;
    setActiveChip('');

    if (!desde || !hasta) {
        showAlert('Por favor, selecciona ambas fechas', 'danger');
        return;
    }

    if (desde > hasta) {
        showAlert('La fecha "Desde" no puede ser mayor que "Hasta"', 'danger');
        return;
    }

    filteredDates = { desde, hasta };
    renderHistorial(filteredDates);
    if (!silent) {
        showAlert(`Filtro aplicado: ${formatDate(desde)} - ${formatDate(hasta)}`, 'info');
    }
}

function clearDateFilter() {
    filteredDates = null;
    document.getElementById('fechaDesde').value = '';
    document.getElementById('fechaHasta').value = '';
    renderHistorial(filteredDates);
    showAlert('Filtro de fechas eliminado', 'info');
    setActiveChip('');
}

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
    const { rows, totals } = computeResumenData(filteredDates);
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
    const filename = filteredDates
        ? `resumen_${filteredDates.desde}_${filteredDates.hasta}.csv`
        : 'resumen_completo.csv';
    downloadFile(content, filename, 'text/csv;charset=utf-8');
    showAlert(`Archivo ${filename} descargado`, 'success');
}

function emailResumen() {
    const { rows, totals } = computeResumenData(filteredDates);
    if (!rows.length) {
        showAlert('No hay datos para enviar', 'danger');
        return;
    }

    const rango = filteredDates
        ? `${formatDate(filteredDates.desde)} - ${formatDate(filteredDates.hasta)}`
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
        
        if (filteredDates) {
            showAlert(`Email consolidado preparado para el período ${formatDate(filteredDates.desde)} - ${formatDate(filteredDates.hasta)}`, 'success');
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

    // Función para formatear input con símbolo € (adaptada para type="number")
    function formatInputWithEuro(input) {
        const value = input.value;
        if (value && value.trim() !== '') {
            const numValue = parseFloat(value);
            if (!isNaN(numValue) && numValue > 0) {
                // Para campos type="number", mantenemos el valor numérico
                // pero mostramos el formato con € en un elemento visual adicional
                input.value = numValue.toFixed(2);
                updateCurrencyDisplay(input, numValue);
            }
        }
    }

    // Función para actualizar la visualización de moneda
    function updateCurrencyDisplay(input, value) {
        const container = input.closest('.currency');
        if (container) {
            let display = container.querySelector('.currency-display');
            if (!display) {
                display = document.createElement('span');
                display.className = 'currency-display';
                display.style.cssText = 'position: absolute; right: 10px; top: 50%; transform: translateY(-50%); color: #666; pointer-events: none; font-size: 14px;';
                container.style.position = 'relative';
                container.appendChild(display);
            }
            if (value > 0) {
                display.textContent = '€';
                display.style.display = 'block';
            } else {
                display.style.display = 'none';
            }
        }
    }

    // Función para limpiar formato cuando se enfoca
    function cleanInputOnFocus(input) {
        // Para type="number", simplemente limpiamos si es 0
        if (parseFloat(input.value) === 0 || input.value === '0.00') {
            input.value = '';
        }
        // Ocultar el símbolo € durante la edición
        const container = input.closest('.currency');
        if (container) {
            const display = container.querySelector('.currency-display');
            if (display) {
                display.style.display = 'none';
            }
        }
    }

    // Event listeners para recálculo automático y formateo
    ['apertura', 'ingresos', 'ingresosTarjetaExora', 'ingresosTarjetaDatafono', 'cierre'].forEach(id => {
        const element = document.getElementById(id);
        let formatTimer = null;
        
        // Función para formateo automático con delay
        function scheduleFormat() {
            clearTimeout(formatTimer);
            formatTimer = setTimeout(() => {
                const currentValue = element.value;
                if (currentValue && currentValue.trim() !== '') {
                    const numValue = parseFloat(currentValue);
                    if (!isNaN(numValue) && numValue > 0) {
                        formatInputWithEuro(element);
                        // Recalcular después del formateo automático
                        setTimeout(() => recalc(), 10);
                    }
                }
            }, 1200); // Formatear después de 1.2 segundos de inactividad
        }
        
        // Recalcular en tiempo real con múltiples eventos para mejor compatibilidad
        ['input', 'change', 'keyup', 'paste'].forEach(eventType => {
            element.addEventListener(eventType, () => {
                // Recalcular inmediatamente
                setTimeout(() => {
                    recalc();
                }, 10);
                
                // Programar formateo automático
                scheduleFormat();
            });
        });
        
        // Formatear con € al perder el foco
        element.addEventListener('blur', function() {
            clearTimeout(formatTimer);
            formatInputWithEuro(this);
            // Recalcular después del formateo
            setTimeout(() => recalc(), 10);
        });
        
        // Limpiar formato al enfocar
        element.addEventListener('focus', function() {
            clearTimeout(formatTimer);
            cleanInputOnFocus(this);
        });
        
        // Mostrar € inmediatamente cuando hay valor
        element.addEventListener('input', function() {
            const value = parseFloat(this.value);
            if (!isNaN(value) && value > 0) {
                updateCurrencyDisplay(this, value);
            } else {
                const container = this.closest('.currency');
                if (container) {
                    const display = container.querySelector('.currency-display');
                    if (display) {
                        display.style.display = 'none';
                    }
                }
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
            currentEditKey = matches[0];
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
            e.preventDefault();
            tryAddMovimiento();
        }
    });

    // Event listeners para el campo de importe de movimientos
    const importeMovimientoEl = document.getElementById('importeMovimiento');
    let formatTimerMovimiento = null;
    
    // Función para formateo automático con delay para movimientos
    function scheduleFormatMovimiento() {
        clearTimeout(formatTimerMovimiento);
        formatTimerMovimiento = setTimeout(() => {
            const currentValue = importeMovimientoEl.value;
            if (currentValue && currentValue.trim() !== '') {
                const numValue = parseFloat(currentValue);
                if (!isNaN(numValue) && numValue > 0) {
                    formatInputWithEuro(importeMovimientoEl);
                    // Recalcular después del formateo automático
                    setTimeout(() => recalc(), 10);
                }
            }
        }, 1200); // Formatear después de 1.2 segundos de inactividad
    }
    
    // Recalcular en tiempo real con múltiples eventos para mejor compatibilidad
    ['input', 'change', 'keyup', 'paste'].forEach(eventType => {
        importeMovimientoEl.addEventListener(eventType, () => {
            // Recalcular inmediatamente
            setTimeout(() => {
                recalc();
            }, 10);
            
            // Programar formateo automático
            scheduleFormatMovimiento();
        });
    });
    
    // Event listener para blur (perder foco) en el importe de movimientos
    importeMovimientoEl.addEventListener('blur', function() {
        clearTimeout(formatTimerMovimiento);
        // Formatear primero si hay valor
        if (this.value) {
            formatInputWithEuro(this);
            // Luego intentar agregar el movimiento si hay un importe válido
            setTimeout(() => {
                tryAddMovimiento();
                recalc(); // Recalcular después de agregar movimiento
            }, 100); // Pequeño delay para asegurar que se formateó
        }
    });

    // Limpiar formato al enfocar
    importeMovimientoEl.addEventListener('focus', function() {
        clearTimeout(formatTimerMovimiento);
        cleanInputOnFocus(this);
    });
    
    // Mostrar € inmediatamente cuando hay valor en movimientos
    importeMovimientoEl.addEventListener('input', function() {
        const value = parseFloat(this.value);
        if (!isNaN(value) && value > 0) {
            updateCurrencyDisplay(this, value);
        } else {
            const container = this.closest('.currency');
            if (container) {
                const display = container.querySelector('.currency-display');
                if (display) {
                    display.style.display = 'none';
                }
            }
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
    renderMovimientos(currentMovimientos);
    filterToday(true);
    recalc();
    
    // Observador de mutaciones para detectar cambios en campos de importes
    // Especialmente útil para diferentes tipos de teclados
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'attributes' && mutation.attributeName === 'value') {
                const target = mutation.target;
                if (target.type === 'number' && 
                    ['apertura', 'ingresos', 'ingresosTarjetaExora', 'ingresosTarjetaDatafono', 'cierre', 'importeMovimiento'].includes(target.id)) {
                    setTimeout(() => recalc(), 20);
                }
            }
        });
    });
    
    // Observar cambios en todos los campos de importe
    const monitoredFields = {};
    ['apertura', 'ingresos', 'ingresosTarjetaExora', 'ingresosTarjetaDatafono', 'cierre', 'importeMovimiento'].forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            observer.observe(element, { 
                attributes: true, 
                attributeFilter: ['value'],
                subtree: false 
            });
            
            // Inicializar valor para polling
            monitoredFields[id] = element.value;
        }
    });
    
    // Polling adicional para detectar cambios que podrían no ser capturados por eventos
    // Especialmente útil para teclados personalizados del iPad
    setInterval(() => {
        let hasChanges = false;
        Object.keys(monitoredFields).forEach(id => {
            const element = document.getElementById(id);
            if (element && element.value !== monitoredFields[id]) {
                monitoredFields[id] = element.value;
                hasChanges = true;
            }
        });
        
        if (hasChanges) {
            recalc();
        }
    }, 500); // Verificar cada 500ms
    

    
    console.log('📊 Sistema de Caja LBJ inicializado correctamente');
});
// Expose functions to global scope
window.hideTests = hideTests;
window.addMovimiento = addMovimiento;
window.saveDay = saveDay;
window.newDay = newDay;
window.deleteCurrentDay = deleteCurrentDay;
window.runTests = runTests;
window.filterToday = filterToday;
window.filterThisWeek = filterThisWeek;
window.filterThisMonth = filterThisMonth;
window.applyDateFilter = applyDateFilter;
window.clearDateFilter = clearDateFilter;
window.removeMovimiento = removeMovimiento;
window.editDay = editDay;
window.deleteDayFromHistorial = deleteDayFromHistorial;
window.loadDraft = loadDraft;
window.changeSucursal = changeSucursal;
window.handleSucursalSave = handleSucursalSave;
window.downloadDayCSV = downloadDayCSV;
window.emailDay = emailDay;
window.downloadResumenCSV = downloadResumenCSV;
window.emailResumen = emailResumen;
window.toggleActionsMenu = toggleActionsMenu;
window.closeAllActionsMenus = closeAllActionsMenus;
window.updateDashboard = updateDashboard;
window.tryAddMovimiento = tryAddMovimiento;

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
  // Campos numéricos: usar teclado numérico nativo del sistema
  document.querySelectorAll('input[inputmode="numeric"]').forEach(el => {
    // Los campos type="number" ya manejan la validación básica
    // Solo necesitamos trigger recalc para campos específicos
    el.addEventListener('input', () => {
      if (['apertura', 'ingresos', 'ingresosTarjetaExora', 'ingresosTarjetaDatafono', 'cierre', 'importeMovimiento'].includes(el.id)) {
        setTimeout(() => {
          if (typeof recalc === 'function') {
            recalc();
          }
        }, 50);
      }
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
try { wireNumericKeyboards(); } catch(e) { console.warn('wireNumericKeyboards()', e); }

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

  // Teclado personalizado desactivado - ahora usamos el teclado numérico del sistema
  // document.querySelectorAll('input[data-numpad]').forEach(inp=>{
  //   inp.setAttribute('readonly', 'readonly');   // evita teclado del sistema en iPad
  //   inp.addEventListener('focus', ()=> showPad(inp));
  //   inp.addEventListener('click', ()=> showPad(inp));
  // });

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
