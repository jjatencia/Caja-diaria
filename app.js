import { parseNum, formatCurrency, formatDate, getTodayString, computeTotals } from "./utils/index.js";
import { getDayIndex, loadDay, saveDayData, deleteDay, saveToLocalStorage, getFromLocalStorage } from "./storage.js";
import { renderMovimientos, renderHistorial, showAlert, displayTestResults, hideTests } from "./ui.js";
import { appendRecord, updateRecord, deleteRecord } from "./api/googleSheets.js";

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./service-worker.js', { updateViaCache: 'none' }).then(registration => {
        registration.update();
        registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (newWorker) {
                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        window.location.reload();
                    }
                });
            }
        });
    });
}

// Variables globales
let currentMovimientos = [];
let filteredDates = null;
let currentEditKey = null;
let currentGoogleSheetsId = null; // Nuevo: para tracking del ID en Google Sheets
const API_KEY = globalThis.API_KEY || '';

const empleadosPorSucursal = {
    "Lliçà d'Amunt": ["Juanjo", "Jordi", "Ian Paul", "Miquel"],
    "Parets del Vallès": ["Juanjo", "Quim", "Genís", "Alex"]
};

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

function openSucursalModal() {
    const modal = document.getElementById('sucursalSetup');
    const saveBtn = document.getElementById('guardarSucursal');
    const selectInicial = document.getElementById('sucursalInicial');
    if (modal && saveBtn && selectInicial) {
        const current = localStorage.getItem('sucursal');
        if (current) {
            selectInicial.value = current;
        }
        modal.style.display = 'flex';
        saveBtn.addEventListener('click', () => {
            const selected = selectInicial.value;
            localStorage.setItem('sucursal', selected);
            modal.style.display = 'none';
            applySucursal();
        }, { once: true });
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
        responsableCierre: document.getElementById('responsableCierre').value.trim(),
        googleSheetsId: currentGoogleSheetsId // Guardar el ID de Google Sheets
    };
    saveToLocalStorage('caja:draft', draft);
}

function loadDraft() {
    const draft = getFromLocalStorage('caja:draft');
    if (draft) {
        loadFormData(draft);
        currentGoogleSheetsId = draft.googleSheetsId; // Restaurar el ID de Google Sheets
    }
}

// Funciones de UI
function recalc() {
    const apertura = document.getElementById('apertura').value;
    const ingresos = document.getElementById('ingresos').value;
    const cierre = document.getElementById('cierre').value;
    
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

    // Si falta dinero, intenta enviar una alerta
    if (totals.diff < 0) {
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
    const diferenciaTarjeta = ingresosTarjetaExora - ingresosTarjetaDatafono;
    
    const diferenciaTarjetaDiv = document.getElementById('diferenciaTarjetaDisplay');
    if (diferenciaTarjetaDiv) {
        const diffTarjetaFormatted = formatCurrency(diferenciaTarjeta);

        if (Math.abs(diferenciaTarjeta) < 0.01) {
            diferenciaTarjetaDiv.className = 'diferencia cuadra';
            diferenciaTarjetaDiv.innerHTML = `✅ Diferencia Tarjeta: ${diffTarjetaFormatted} € - ¡Cuadra!`;
        } else {
            diferenciaTarjetaDiv.className = 'diferencia no-cuadra';
            diferenciaTarjetaDiv.innerHTML = `⚠️ Diferencia Tarjeta: ${diffTarjetaFormatted} € - No cuadra`;
        }
    }
    saveDraft();
}


function addMovimiento() {
    const tipo = document.getElementById('tipoMovimiento').value;
    const quien = document.getElementById('quienMovimiento').value.trim();
    const importe = document.getElementById('importeMovimiento').value;
    
    if (!importe || parseNum(importe) === 0) {
        showAlert('Por favor, introduce un importe válido', 'danger');
        return;
    }
    
    if (parseNum(importe) < 0) {
        showAlert('El importe no puede ser negativo', 'danger');
        return;
    }
    
    currentMovimientos.push({
        tipo,
        quien: quien || 'No especificado',
        importe: parseNum(importe)
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
    currentGoogleSheetsId = null; // Limpiar ID de Google Sheets
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

    currentMovimientos = data.movimientos || [];
    currentGoogleSheetsId = data.googleSheetsId; // Cargar ID de Google Sheets
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
    
    // Calcular diferencia de tarjeta y totales
    const totals = computeTotals(apertura, ingresos, currentMovimientos, cierre);
    const diferenciaTarjeta = ingresosTarjetaExora - ingresosTarjetaDatafono;
    
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
        googleSheetsId: currentGoogleSheetsId // Incluir ID de Google Sheets
    };

    try {
        // Guardar localmente primero
        currentEditKey = saveDayData(fecha, dayData, currentEditKey);
        localStorage.removeItem('caja:draft');

        // Preparar datos para Google Sheets
        const now = new Date();
        const googleSheetsData = {
            fecha: formatDate(fecha),
            hora: now.toLocaleTimeString('es-ES', { hour12: false }),
            sucursal: sucursal,
            apertura: apertura,
            ingresos: ingresos,
            tarjetaExora: ingresosTarjetaExora,
            tarjetaDatafono: ingresosTarjetaDatafono,
            difTarjeta: diferenciaTarjeta,
            entradas: totals.entradas,
            salidas: totals.salidas,
            total: totals.total,
            cierre: cierre,
            dif: totals.diff
        };

        // Integración con Google Sheets
        try {
            if (currentGoogleSheetsId) {
                // Si existe ID, actualizar registro existente
                await updateRecord(currentGoogleSheetsId, googleSheetsData);
                console.log(`Google Sheets: Registro actualizado con ID ${currentGoogleSheetsId}`);
                showAlert('Día actualizado en Google Sheets correctamente', 'success');
            } else {
                // Si no existe ID, crear nuevo registro
                const googleId = await appendRecord(googleSheetsData);
                currentGoogleSheetsId = googleId;
                
                // Actualizar datos locales con el nuevo ID
                dayData.googleSheetsId = googleId;
                saveDayData(fecha, dayData, currentEditKey);
                
                console.log(`Google Sheets: Nuevo registro creado con ID ${googleId}`);
                showAlert('Día guardado en Google Sheets correctamente', 'success');
            }
        } catch (gsError) {
            console.error('Error en Google Sheets:', gsError);
            showAlert('Día guardado localmente, pero falló la sincronización con Google Sheets', 'warning');
        }

        // API del servidor (mantener funcionalidad existente)
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
                console.log('Servidor: Día guardado correctamente');
            } else {
                console.log('Servidor: Error al guardar el día');
            }
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
        // Eliminar de Google Sheets si existe ID
        if (currentGoogleSheetsId) {
            try {
                await deleteRecord(currentGoogleSheetsId);
                console.log(`Google Sheets: Registro eliminado con ID ${currentGoogleSheetsId}`);
            } catch (gsError) {
                console.error('Error al eliminar de Google Sheets:', gsError);
                showAlert('Día eliminado localmente, pero falló la eliminación en Google Sheets', 'warning');
            }
        }

        deleteDay(currentEditKey);
        clearForm();
        renderHistorial(filteredDates);
        showAlert(`Día ${formatDate(currentEditKey)} borrado correctamente`, 'success');
    }
}

async function deleteDayFromHistorial(fecha) {
    if (confirm(`¿Estás seguro de que quieres borrar el día ${formatDate(fecha)}?`)) {
        // Obtener datos del día para conseguir el googleSheetsId
        const dayData = loadDay(fecha);
        
        // Eliminar de Google Sheets si existe ID
        if (dayData && dayData.googleSheetsId) {
            try {
                await deleteRecord(dayData.googleSheetsId);
                console.log(`Google Sheets: Registro eliminado con ID ${dayData.googleSheetsId}`);
            } catch (gsError) {
                console.error('Error al eliminar de Google Sheets:', gsError);
                showAlert('Día eliminado localmente, pero falló la eliminación en Google Sheets', 'warning');
            }
        }

        deleteDay(fecha);
        if (currentEditKey === fecha) {
            clearForm();
        }

        renderHistorial(filteredDates);
        showAlert(`Día ${formatDate(fecha)} borrado correctamente`, 'success');
    }
}

function editDay(fecha) {
    const data = loadDay(fecha);
    if (data) {
        loadFormData(data);
        currentEditKey = fecha;
        currentGoogleSheetsId = data.googleSheetsId; // Cargar ID de Google Sheets
        showAlert(`Día ${formatDate(fecha)} cargado para edición`, 'info');
        // Hacer scroll hacia arriba para ver el formulario
        document.querySelector('.header').scrollIntoView({ behavior: 'smooth' });
    } else {
        showAlert('No se pudo cargar el día seleccionado', 'danger');
    }
}


// Funciones de filtrado
function filterToday() {
    const today = new Date();
    const todayStr = new Date(today.getTime() - today.getTimezoneOffset() * 60000)
        .toISOString()
        .split('T')[0];
    document.getElementById('fechaDesde').value = todayStr;
    document.getElementById('fechaHasta').value = todayStr;
    applyDateFilter();
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
}

function applyDateFilter() {
    const desde = document.getElementById('fechaDesde').value;
    const hasta = document.getElementById('fechaHasta').value;
    
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
    showAlert(`Filtro aplicado: ${formatDate(desde)} - ${formatDate(hasta)}`, 'info');
}

function clearDateFilter() {
    filteredDates = null;
    document.getElementById('fechaDesde').value = '';
    document.getElementById('fechaHasta').value = '';
    renderHistorial(filteredDates);
    showAlert('Filtro de fechas eliminado', 'info');
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
    const diferenciaTarjeta = (dayData.ingresosTarjetaExora || 0) - (dayData.ingresosTarjetaDatafono || 0);
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
    const diferenciaTarjeta = ingresosTarjetaExora - ingresosTarjetaDatafono;

    const emailTo = 'juanjo@labarberiadejuanjo.com';
    const emailSubject = `Resumen Caja LBJ - ${sucursal} - ${formatDate(date.split('#')[0])}`;
    const emailBody = `Hola Juanjo,\n\nRESUMEN DE CAJA LBJ\nFecha: ${formatDate(date.split('#')[0])}\nSucursal: ${sucursal}\n\n═══════════════════════════════════════\n\n1. APERTURA DE CAJA:\n   • Apertura: ${formatCurrency(apertura)} €\n   • Responsable: ${responsableApertura || 'No especificado'}\n\n2. INGRESOS EN EFECTIVO:\n   • Ingresos (Exora): ${formatCurrency(ingresos)} €\n\n3. GESTIÓN DE TESORERÍA:\n   • Total Entradas: ${formatCurrency(totals.entradas)} €\n   • Total Salidas: ${formatCurrency(totals.salidas)} €\n   ${movimientos.length > 0 ? '\n   Detalle movimientos:\n' + movimientos.map(mov => `   - ${mov.tipo === 'entrada' ? 'Entrada' : 'Salida'}: ${formatCurrency(mov.importe)} € (${mov.quien || 'No especificado'})`).join('\n') : '   • No hay movimientos registrados'}\n\n4. INGRESOS EN TARJETA:\n   • Ingresos tarjeta (Exora): ${formatCurrency(ingresosTarjetaExora)} €\n   • Ingresos tarjeta (Datáfono): ${formatCurrency(ingresosTarjetaDatafono)} €\n\n5. CIERRE DE CAJA:\n   • Cierre: ${formatCurrency(cierre)} €\n   • Responsable: ${responsableCierre || 'No especificado'}\n\n6. DIFERENCIAS:\n   • Diferencia Efectivo: ${formatCurrency(totals.diff)} € ${Math.abs(totals.diff) < 0.01 ? '✓ CUADRA' : '⚠ NO CUADRA'}\n   • Diferencia Tarjeta: ${formatCurrency(diferenciaTarjeta)} € ${Math.abs(diferenciaTarjeta) < 0.01 ? '✓ CUADRA' : '⚠ NO CUADRA'}\n\n═══════════════════════════════════════\n\nSistema de Gestión de Caja LBJ\nGenerado automáticamente el ${formatDate(new Date().toISOString().split('T')[0])}`;

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
                       result.diff === 30;
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
    renderMovimientos(currentMovimientos);
    renderHistorial(filteredDates);
    recalc();
    
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
window.downloadDayCSV = downloadDayCSV;
window.emailDay = emailDay;
window.downloadResumenCSV = downloadResumenCSV;
window.emailResumen = emailResumen;
window.toggleActionsMenu = toggleActionsMenu;
window.closeAllActionsMenus = closeAllActionsMenus;
