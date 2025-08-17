import { parseNum, formatCurrency, formatDate, getTodayString, computeTotals } from "./utils.js";
import { getDayIndex, loadDay, saveDayData, deleteDay } from "./storage.js";
import { renderMovimientos, renderHistorial, showAlert, displayTestResults, hideTests } from "./ui.js";

// Variables globales
let currentMovimientos = [];
let filteredDates = null;

// Funciones de UI
function recalc() {
    const apertura = document.getElementById('apertura').value;
    const ingresos = document.getElementById('ingresos').value;
    const cierre = document.getElementById('cierre').value;
    
    const totals = computeTotals(apertura, ingresos, currentMovimientos, cierre);
    
    const diferenciaDiv = document.getElementById('diferenciaDisplay');
    const diffFormatted = formatCurrency(totals.diff);
    
    if (Math.abs(totals.diff) < 0.01) {
        diferenciaDiv.className = 'diferencia cuadra';
        diferenciaDiv.innerHTML = `✅ Diferencia Efectivo: ${diffFormatted} € - ¡Cuadra!`;
    } else {
        diferenciaDiv.className = 'diferencia no-cuadra';
        diferenciaDiv.innerHTML = `⚠️ Diferencia Efectivo: ${diffFormatted} € - No cuadra`;
    }
    
    // Calcular diferencia de tarjeta
    const ingresosTarjetaExora = parseNum(document.getElementById('ingresosTarjetaExora').value);
    const ingresosTarjetaDatafono = parseNum(document.getElementById('ingresosTarjetaDatafono').value);
    const diferenciaTarjeta = ingresosTarjetaExora - ingresosTarjetaDatafono;
    
    const diferenciaTarjetaDiv = document.getElementById('diferenciaTarjetaDisplay');
    const diffTarjetaFormatted = formatCurrency(diferenciaTarjeta);
    
    if (Math.abs(diferenciaTarjeta) < 0.01) {
        diferenciaTarjetaDiv.className = 'diferencia cuadra';
        diferenciaTarjetaDiv.innerHTML = `✅ Diferencia Tarjeta: ${diffTarjetaFormatted} € - ¡Cuadra!`;
    } else {
        diferenciaTarjetaDiv.className = 'diferencia no-cuadra';
        diferenciaTarjetaDiv.innerHTML = `⚠️ Diferencia Tarjeta: ${diffTarjetaFormatted} € - No cuadra`;
    }
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
    recalc();
}

function loadFormData(data) {
    document.getElementById('fecha').value = data.fecha;
    document.getElementById('sucursal').value = data.sucursal;
    document.getElementById('apertura').value = formatCurrency(data.apertura);
    document.getElementById('responsableApertura').value = data.responsableApertura;
    document.getElementById('ingresos').value = formatCurrency(data.ingresos);
    document.getElementById('ingresosTarjetaExora').value = formatCurrency(data.ingresosTarjetaExora || 0);
    document.getElementById('ingresosTarjetaDatafono').value = formatCurrency(data.ingresosTarjetaDatafono || 0);
    document.getElementById('cierre').value = formatCurrency(data.cierre);
    document.getElementById('responsableCierre').value = data.responsableCierre;
    
    currentMovimientos = data.movimientos || [];
    renderMovimientos(currentMovimientos);
    recalc();
}

function saveDay() {
    const fecha = document.getElementById('fecha').value;
    const sucursal = document.getElementById('sucursal').value;
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
        responsableCierre
    };
    
    saveDayData(fecha, dayData);
    showAlert('Día guardado correctamente', 'success');
    renderHistorial(filteredDates);
}

function newDay() {
    clearForm();
    showAlert('Formulario limpiado para nuevo día', 'info');
}

function deleteCurrentDay() {
    const fecha = document.getElementById('fecha').value;
    if (!fecha) {
        showAlert('No hay fecha seleccionada para borrar', 'danger');
        return;
    }

    const existingData = loadDay(fecha);
    if (!existingData) {
        showAlert('No existe un día guardado para esta fecha', 'danger');
        return;
    }

    if (confirm(`¿Estás seguro de que quieres borrar el día ${formatDate(fecha)}?`)) {
        deleteDay(fecha);
        clearForm();
        renderHistorial(filteredDates);
        showAlert(`Día ${formatDate(fecha)} borrado correctamente`, 'success');
    }
}

function deleteDayFromHistorial(fecha) {
    if (confirm(`¿Estás seguro de que quieres borrar el día ${formatDate(fecha)}?`)) {
        deleteDay(fecha);

        const currentDate = document.getElementById('fecha').value;
        if (currentDate === fecha) {
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
        showAlert(`Día ${formatDate(fecha)} cargado para edición`, 'info');
        // Hacer scroll hacia arriba para ver el formulario
        document.querySelector('.header').scrollIntoView({ behavior: 'smooth' });
    } else {
        showAlert('No se pudo cargar el día seleccionado', 'danger');
    }
}


// Funciones de filtrado
function filterToday() {
    const today = getTodayString();
    document.getElementById('fechaDesde').value = today;
    document.getElementById('fechaHasta').value = today;
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
    
    const mondayStr = monday.toISOString().split('T')[0];
    const sundayStr = sunday.toISOString().split('T')[0];
    
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
    
    // Ajustar las fechas para evitar desfases por zona horaria
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

function exportCombinedCSV() {
    const dates = getDayIndex().sort((a, b) => b.localeCompare(a));
    
    if (!dates.length) {
        showAlert('No hay datos para exportar', 'danger');
        return;
    }
    
    // Generar contenido de caja
    const cajaHeaders = [
        'Fecha', 'Sucursal', 'Apertura de caja (€)', 'Responsable apertura de caja',
        'Ingresos en efectivo (€)', 'Gestión de tesorería (salidas)', 'Gestión de tesorería (entradas)',
        'Total en caja', 'Cierre de caja', 'Diferencia', 'Responsable de cierre de caja'
    ];
    
    const cajaData = [];
    dates.forEach(date => {
        const dayData = loadDay(date);
        if (dayData) {
            const totals = computeTotals(dayData.apertura, dayData.ingresos, dayData.movimientos, dayData.cierre);
            cajaData.push([
                formatDate(date), dayData.sucursal, dayData.apertura, dayData.responsableApertura,
                dayData.ingresos, totals.salidas, totals.entradas, totals.total,
                dayData.cierre, totals.diff, dayData.responsableCierre
            ]);
        }
    });
    
    // Generar contenido de movimientos
    const movHeaders = ['Fecha', 'Tipo', 'Quién', 'Importe (€)'];
    const movData = [];
    
    dates.forEach(date => {
        const dayData = loadDay(date);
        if (dayData && dayData.movimientos && dayData.movimientos.length > 0) {
            dayData.movimientos.forEach(mov => {
                if (mov && mov.tipo) {
                    movData.push([
                        formatDate(date),
                        mov.tipo === 'entrada' ? 'Entrada' : 'Salida',
                        mov.quien || 'No especificado',
                        mov.importe || 0
                    ]);
                }
            });
        }
    });
    
    // Crear archivo combinado con ambas secciones
    const BOM = '\uFEFF';
    let combinedContent = BOM;
    
    // Sección Caja
    combinedContent += '=== DATOS DE CAJA ===\n';
    combinedContent += cajaHeaders.join(';') + '\n';
    cajaData.forEach(row => {
        const csvRow = row.map(cell => {
            if (typeof cell === 'number') {
                return cell.toLocaleString('es-ES', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                });
            }
            return String(cell || '');
        });
        combinedContent += csvRow.join(';') + '\n';
    });
    
    // Separador
    combinedContent += '\n=== MOVIMIENTOS DE TESORERÍA ===\n';
    
    // Sección Movimientos
    combinedContent += movHeaders.join(';') + '\n';
    if (movData.length > 0) {
        movData.forEach(row => {
            const csvRow = row.map(cell => {
                if (typeof cell === 'number') {
                    return cell.toLocaleString('es-ES', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                    });
                }
                return String(cell || '');
            });
            combinedContent += csvRow.join(';') + '\n';
        });
    } else {
        combinedContent += 'No hay movimientos registrados\n';
    }
    
    // Generar nombre de archivo con fecha
    const today = new Date().toISOString().split('T')[0];
    const filename = `datos_caja_${today}.csv`;
    
    downloadFile(combinedContent, filename, 'text/csv;charset=utf-8');
    showAlert(`Archivo ${filename} descargado con datos de caja y movimientos`, 'success');
}

function exportAndEmail() {
    // Verificar si hay filtro activo
    if (filteredDates) {
        // ENVÍO DE RESUMEN CONSOLIDADO (FILTRO ACTIVO)
        exportFilteredSummaryEmail();
    } else {
        // ENVÍO DEL DÍA ACTUAL (SIN FILTRO)
        exportCurrentDayEmail();
    }
}

function exportCurrentDayEmail() {
    const fecha = document.getElementById('fecha').value;
    const sucursal = document.getElementById('sucursal').value;
    
    if (!fecha || !sucursal) {
        showAlert('Por favor, completa la fecha y sucursal antes de enviar el email', 'danger');
        return;
    }
    
    // Obtener datos del día actual del formulario
    const apertura = parseNum(document.getElementById('apertura').value);
    const responsableApertura = document.getElementById('responsableApertura').value.trim();
    const ingresos = parseNum(document.getElementById('ingresos').value);
    const ingresosTarjetaExora = parseNum(document.getElementById('ingresosTarjetaExora').value);
    const ingresosTarjetaDatafono = parseNum(document.getElementById('ingresosTarjetaDatafono').value);
    const cierre = parseNum(document.getElementById('cierre').value);
    const responsableCierre = document.getElementById('responsableCierre').value.trim();
    
    // Calcular totales
    const totals = computeTotals(apertura, ingresos, currentMovimientos, cierre);
    const diferenciaTarjeta = ingresosTarjetaExora - ingresosTarjetaDatafono;
    
    // Preparar datos para el email
    const emailTo = 'juanjo@labarberiadejuanjo.com';
    const emailSubject = `Resumen Caja Diaria - ${sucursal} - ${formatDate(fecha)}`;
    
    const emailBody = `Hola Juanjo,

RESUMEN DE CAJA DIARIA
Fecha: ${formatDate(fecha)}
Sucursal: ${sucursal}

═══════════════════════════════════════

1. APERTURA DE CAJA:
   • Apertura: ${formatCurrency(apertura)} €
   • Responsable: ${responsableApertura || 'No especificado'}

2. INGRESOS EN EFECTIVO:
   • Ingresos (Exora): ${formatCurrency(ingresos)} €

3. GESTIÓN DE TESORERÍA:
   • Total Entradas: ${formatCurrency(totals.entradas)} €
   • Total Salidas: ${formatCurrency(totals.salidas)} €
   ${currentMovimientos.length > 0 ? '\n   Detalle movimientos:\n' + currentMovimientos.map(mov => 
   `   - ${mov.tipo === 'entrada' ? 'Entrada' : 'Salida'}: ${formatCurrency(mov.importe)} € (${mov.quien || 'No especificado'})`
   ).join('\n') : '   • No hay movimientos registrados'}

4. INGRESOS EN TARJETA:
   • Ingresos tarjeta (Exora): ${formatCurrency(ingresosTarjetaExora)} €
   • Ingresos tarjeta (Datáfono): ${formatCurrency(ingresosTarjetaDatafono)} €

5. CIERRE DE CAJA:
   • Cierre: ${formatCurrency(cierre)} €
   • Responsable: ${responsableCierre || 'No especificado'}

6. DIFERENCIAS:
   • Diferencia Efectivo: ${formatCurrency(totals.diff)} € ${Math.abs(totals.diff) < 0.01 ? '✓ CUADRA' : '⚠ NO CUADRA'}
   • Diferencia Tarjeta: ${formatCurrency(diferenciaTarjeta)} € ${Math.abs(diferenciaTarjeta) < 0.01 ? '✓ CUADRA' : '⚠ NO CUADRA'}

═══════════════════════════════════════

Sistema de Gestión de Caja Diaria
Generado automáticamente el ${formatDate(new Date().toISOString().split('T')[0])}`;

    sendEmail(emailTo, emailSubject, emailBody);
}

function exportFilteredSummaryEmail() {
    let dates = getDayIndex();
    
    // Aplicar filtro de fechas
    dates = dates.filter(date => date >= filteredDates.desde && date <= filteredDates.hasta);
    
    if (!dates.length) {
        showAlert('No hay datos en el filtro para enviar por email', 'danger');
        return;
    }
    
    // Calcular totales consolidados
    let totalApertura = 0;
    let totalIngresos = 0;
    let totalIngresosTarjetaExora = 0;
    let totalIngresosTarjetaDatafono = 0;
    let totalEntradas = 0;
    let totalSalidas = 0;
    let totalCierre = 0;
    let sucursalesInvolucradas = new Set();
    let diasProcesados = 0;
    
    dates.forEach(date => {
        const dayData = loadDay(date);
        if (dayData) {
            diasProcesados++;
            sucursalesInvolucradas.add(dayData.sucursal);
            
            totalApertura += parseNum(dayData.apertura);
            totalIngresos += parseNum(dayData.ingresos);
            totalIngresosTarjetaExora += parseNum(dayData.ingresosTarjetaExora || 0);
            totalIngresosTarjetaDatafono += parseNum(dayData.ingresosTarjetaDatafono || 0);
            totalCierre += parseNum(dayData.cierre);
            
            // Sumar movimientos
            if (dayData.movimientos) {
                dayData.movimientos.forEach(mov => {
                    if (mov && mov.tipo && mov.importe) {
                        if (mov.tipo === 'entrada') {
                            totalEntradas += parseNum(mov.importe);
                        } else if (mov.tipo === 'salida') {
                            totalSalidas += parseNum(mov.importe);
                        }
                    }
                });
            }
        }
    });
    
    // Calcular diferencias totales
    const totalTeoricoEfectivo = totalApertura + totalIngresos + totalEntradas - totalSalidas;
    const diferenciaTotalEfectivo = totalTeoricoEfectivo - totalCierre;
    const diferenciaTotalTarjeta = totalIngresosTarjetaExora - totalIngresosTarjetaDatafono;
    
    // Preparar email
    const emailTo = 'juanjo@labarberiadejuanjo.com';
    const sucursalesStr = Array.from(sucursalesInvolucradas).join(' y ');
    const emailSubject = `Resumen Consolidado - ${sucursalesStr} - ${formatDate(filteredDates.desde)} a ${formatDate(filteredDates.hasta)}`;
    
    const emailBody = `Hola Juanjo,

RESUMEN CONSOLIDADO DE CAJA
Período: ${formatDate(filteredDates.desde)} - ${formatDate(filteredDates.hasta)}
Sucursales: ${sucursalesStr}
Días procesados: ${diasProcesados}

═══════════════════════════════════════

1. TOTALES DE APERTURA:
   • Total Aperturas: ${formatCurrency(totalApertura)} €

2. TOTALES DE INGRESOS EN EFECTIVO:
   • Total Ingresos (Exora): ${formatCurrency(totalIngresos)} €

3. TOTALES DE GESTIÓN DE TESORERÍA:
   • Total Entradas: ${formatCurrency(totalEntradas)} €
   • Total Salidas: ${formatCurrency(totalSalidas)} €

4. TOTALES DE INGRESOS EN TARJETA:
   • Total Ingresos tarjeta (Exora): ${formatCurrency(totalIngresosTarjetaExora)} €
   • Total Ingresos tarjeta (Datáfono): ${formatCurrency(totalIngresosTarjetaDatafono)} €

5. TOTALES DE CIERRE:
   • Total Cierres: ${formatCurrency(totalCierre)} €

6. DIFERENCIAS CONSOLIDADAS:
   • Diferencia Total Efectivo: ${formatCurrency(diferenciaTotalEfectivo)} € ${Math.abs(diferenciaTotalEfectivo) < 0.01 ? '✓ CUADRA' : '⚠ NO CUADRA'}
   • Diferencia Total Tarjeta: ${formatCurrency(diferenciaTotalTarjeta)} € ${Math.abs(diferenciaTotalTarjeta) < 0.01 ? '✓ CUADRA' : '⚠ NO CUADRA'}

7. RESUMEN CALCULADO:
   • Total teórico en efectivo: ${formatCurrency(totalTeoricoEfectivo)} €
   • Total real cerrado: ${formatCurrency(totalCierre)} €

═══════════════════════════════════════

Sistema de Gestión de Caja Diaria
Resumen consolidado generado el ${formatDate(new Date().toISOString().split('T')[0])}`;

    sendEmail(emailTo, emailSubject, emailBody);
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
                saveDayData(testDate, testData);
                
                // Verificar que está en el índice
                let index = getDayIndex();
                const wasInIndex = index.includes(testDate);
                
                // Eliminar
                deleteDay(testDate);
                
                // Verificar que se eliminó
                index = getDayIndex();
                const isStillInIndex = index.includes(testDate);
                const dataExists = loadDay(testDate) !== null;
                
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
    
    // Event listeners para recálculo automático
    ['apertura', 'ingresos', 'ingresosTarjetaExora', 'ingresosTarjetaDatafono', 'cierre'].forEach(id => {
        const element = document.getElementById(id);
        element.addEventListener('input', recalc);
        element.addEventListener('blur', function() {
            this.value = formatCurrency(this.value);
        });
    });
    
    // Event listener para cambio de fecha
    document.getElementById('fecha').addEventListener('change', function() {
        const selectedDate = this.value;
        const existingData = loadDay(selectedDate);
        
        if (existingData) {
            loadFormData(existingData);
            showAlert('Día cargado desde el historial', 'info');
        } else {
            // Mantener fecha pero limpiar otros campos
            const currentDate = this.value;
            clearForm();
            this.value = currentDate;
        }
    });
    
    // Event listener para Enter en el formulario de movimientos
    document.getElementById('importeMovimiento').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            addMovimiento();
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
    renderMovimientos(currentMovimientos);
    renderHistorial(filteredDates);
    recalc();
    
    console.log('📊 Sistema de Caja Diaria inicializado correctamente');
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
window.exportCombinedCSV = exportCombinedCSV;
window.exportAndEmail = exportAndEmail;
window.removeMovimiento = removeMovimiento;
window.editDay = editDay;
window.deleteDayFromHistorial = deleteDayFromHistorial;
