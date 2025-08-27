# 💰 Gestión de Caja LBJ

Sistema de gestión de caja diaria para las barberías LBJ. Aplicación web progresiva (PWA) con sincronización automática a Google Sheets y funcionalidad offline.

## 🚀 Características

- ✅ **PWA (Progressive Web App)** - Instalable en móviles y tablets
- 🔄 **Sincronización con Google Sheets** - Backup automático en la nube
- 📱 **Funcionalidad Offline** - Funciona sin conexión a internet
- 💾 **Almacenamiento Local** - Los datos se guardan localmente como respaldo
- 📊 **Reportes y Exportación** - Exporta datos a CSV y envía por email
- 🏪 **Multi-Sucursal** - Soporte para múltiples ubicaciones
- 👥 **Gestión de Empleados** - Control de responsables por sucursal

## 🛠️ Instalación y Configuración

### 1. Instalación de Dependencias

```bash
npm install
```

### 2. Configuración de Variables de Entorno

Copia el archivo de ejemplo y configura tus variables:

```bash
cp .env.example .env
```

Edita el archivo `.env` con tus valores:

```env
# Google Sheets - OBLIGATORIO
GSHEET_ID=tu_google_sheet_id_aqui
GSHEET_CREDENTIALS={"type":"service_account",...}

# Base de Datos PostgreSQL - OPCIONAL
DB_HOST=localhost
DB_PORT=5432
DB_USER=tu_usuario
DB_PASS=tu_password
DB_NAME=caja_lbj

# Email - OPCIONAL (para reportes automáticos)
EMAIL_HOST=smtp.gmail.com
EMAIL_USER=tu_email@gmail.com
EMAIL_PASS=tu_app_password

# API Key - OPCIONAL (para funciones avanzadas)
API_KEY=tu_api_key_secreta
```

### 3. Configuración de Google Sheets

1. **Crear un Proyecto en Google Cloud:**
   - Ve a [Google Cloud Console](https://console.cloud.google.com/)
   - Crea un nuevo proyecto o selecciona uno existente

2. **Habilitar APIs:**
   - Habilita la "Google Sheets API"
   - Habilita la "Google Drive API"

3. **Crear Cuenta de Servicio:**
   - Ve a "IAM & Admin" > "Service Accounts"
   - Crea una nueva cuenta de servicio
   - Descarga el archivo JSON de credenciales

4. **Configurar Google Sheet:**
   - Crea una nueva hoja de cálculo
   - Comparte la hoja con el email de la cuenta de servicio
   - Copia el ID de la hoja (de la URL)

5. **Configurar Variables:**
   ```env
   GSHEET_ID=1ABC123def456GHI789jkl
   GSHEET_CREDENTIALS=./config/google-credentials.json
   ```

### 4. Estructura de Google Sheets

La aplicación espera las siguientes hojas:

#### Hoja "LBJ" (Principal):
| A | B | C | D | E | F | G | H | I | J | K | L | M | N |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| ID | Fecha | Hora | Sucursal | Apertura | Ingresos | Tarjeta Exora | Tarjeta Datáfono | Dif. Tarjeta | Entradas | Salidas | Total | Cierre | Diferencia |

#### Hoja "Tesorería" (Movimientos):
| A | B | C | D | E | F |
|---|---|---|---|---|---|
| ID Cierre | Fecha | Tipo | Quien | Importe | Descripción |

## 🚀 Uso

### Desarrollo Local

```bash
# Iniciar servidor de desarrollo
npm run dev
# o
npm run serve
```

Visita `http://localhost:8000`

### Producción

1. **Servidor Node.js:**
   ```bash
   npm start
   ```

2. **Servidor Web Estático:**
   - Copia todos los archivos a tu servidor web
   - Configura las variables de entorno
   - Accede desde el navegador

## 📱 Instalación como PWA

1. **En móviles:** Abre en el navegador y selecciona "Añadir a pantalla de inicio"
2. **En desktop:** Busca el icono de instalación en la barra de direcciones

## 🏪 Configuración de Sucursales

Las sucursales y empleados se configuran en `modules/employees.js`:

```javascript
export const empleadosPorSucursal = {
    "Lliçà d'Amunt": ["Juanjo", "Jordi", "Ian Paul", "Miquel"],
    "Parets del Vallès": ["Juanjo", "Quim", "Genís", "Alex"]
};
```

## 🧪 Testing

```bash
# Ejecutar tests
npm test

# Ejecutar tests en modo watch
npm run test:watch
```

## 📁 Estructura del Proyecto

```
├── 📁 api/                   # Endpoints del servidor
├── 📁 config/               # Configuración
├── 📁 modules/              # Módulos organizados
│   ├── state.js            # Gestión de estado
│   ├── employees.js        # Empleados y sucursales
│   ├── filters.js          # Filtros y búsquedas
│   └── movimientos.js      # Gestión de movimientos
├── 📁 utils/               # Utilidades
├── 📁 __tests__/           # Tests
├── app.js                  # Aplicación principal
├── ui.js                   # Gestión de UI
├── storage.js              # Almacenamiento local
├── service-worker.js       # Service Worker PWA
├── styles.css              # Estilos
├── index.html              # HTML principal
├── manifest.json           # Manifest PWA
└── package.json            # Configuración NPM
```

## 🔒 Seguridad

- ✅ Las credenciales de Google están externalizadas
- ✅ Variables de entorno para configuración sensible
- ✅ API Key para autenticación
- ✅ Archivos sensibles en .gitignore

## 🐛 Solución de Problemas

### Problemas Comunes

1. **"Error al sincronizar con Google Sheets"**
   - Verifica las credenciales de Google
   - Comprueba que la hoja esté compartida con la cuenta de servicio

2. **"No se pueden guardar los datos"**
   - Verifica que localStorage esté disponible
   - Comprueba la consola del navegador para errores

3. **"La aplicación no funciona offline"**
   - Asegúrate de que el Service Worker esté registrado
   - Verifica la consola de Service Worker en DevTools

### Logs y Debugging

- Abre las herramientas de desarrollador (F12)
- Ve a la pestaña "Console" para ver los logs
- Ve a "Application" > "Service Workers" para debug PWA

## 📈 Mejoras Futuras

- [ ] Dashboard avanzado con gráficos
- [ ] Notificaciones push
- [ ] Sincronización en tiempo real
- [ ] Backup automático a múltiples servicios
- [ ] Sistema de permisos más granular
- [ ] Integración con sistemas de punto de venta

## 🤝 Contribuir

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/nueva-funcionalidad`)
3. Commit tus cambios (`git commit -am 'Añade nueva funcionalidad'`)
4. Push a la rama (`git push origin feature/nueva-funcionalidad`)
5. Crea un Pull Request

## 📄 Licencia

Este proyecto está bajo la Licencia ISC.

## 👥 Soporte

Para soporte técnico o preguntas, contacta al equipo de desarrollo.