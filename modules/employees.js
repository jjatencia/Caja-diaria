// Employee management module
export const empleadosPorSucursal = {
    "Lliçà d'Amunt": ["Juanjo", "Jordi", "Ian Paul", "Miquel"],
    "Parets del Vallès": ["Juanjo", "Quim", "Genís", "Alex"]
};

export function updateResponsables() {
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

export function applySucursal() {
    const saved = localStorage.getItem('sucursal');
    const display = document.getElementById('currentSucursal');
    if (display) {
        display.textContent = saved || '';
    }
    updateResponsables();
}