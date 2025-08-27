# 🚀 Guía de Deploy - Gestión de Caja LBJ

Esta guía te ayudará a desplegar la aplicación en diferentes plataformas.

## 📋 Preparación Previa

1. **Ejecutar el build:**
   ```bash
   npm run build
   ```
   Esto creará el directorio `public/` con todos los archivos necesarios.

2. **Configurar variables de entorno** en tu plataforma de deploy.

## 🌐 Plataformas de Deploy Soportadas

### 1. **Vercel** (Recomendado)

#### Configuración:
- **Build Command:** `npm run build`
- **Output Directory:** `public`
- **Install Command:** `npm install`

#### Variables de entorno requeridas:
```
GSHEET_ID=tu_google_sheet_id
GSHEET_CREDENTIALS={"type":"service_account",...}
API_KEY=tu_api_key_secreta
```

#### Deploy:
```bash
# Instalar Vercel CLI (si no lo tienes)
npm i -g vercel

# Deploy
npm run deploy:vercel
```

### 2. **Netlify**

#### Configuración:
- **Build Command:** `npm run build`
- **Publish Directory:** `public`
- **Node Version:** `18`

#### Variables de entorno:
Configurar las mismas variables que en Vercel a través del panel de Netlify.

#### Deploy:
```bash
# Instalar Netlify CLI (si no lo tienes)
npm i -g netlify-cli

# Deploy
npm run deploy:netlify
```

### 3. **GitHub Pages**

#### Configuración:
1. Crear directorio `.github/workflows/`
2. Agregar el archivo de workflow (ver abajo)
3. Push a GitHub
4. Habilitar GitHub Pages en Settings

### 4. **Servidor VPS/Dedicado**

#### Opción A: Servir archivos estáticos
```bash
# Build
npm run build

# Copiar public/ a tu servidor web
scp -r public/* usuario@servidor:/var/www/html/

# Configurar nginx/apache para servir desde public/
```

#### Opción B: Node.js con express
```bash
# En tu servidor
git clone tu-repo
cd tu-repo
npm install
npm run build
npm start
```

## 📁 Estructura de Archivos Después del Build

```
public/
├── index.html          # Página principal
├── app.js             # Aplicación principal
├── ui.js              # Gestión de UI
├── storage.js         # Almacenamiento local
├── service-worker.js  # Service Worker PWA
├── styles.css         # Estilos
├── manifest.json      # Manifest PWA
├── icon-180.png       # Icono de la app
├── modules/           # Módulos organizados
│   ├── state.js
│   ├── employees.js
│   ├── filters.js
│   └── movimientos.js
├── utils/             # Utilidades
└── api/               # Endpoints del servidor
```

## 🔧 Variables de Entorno por Plataforma

### Variables OBLIGATORIAS:
```env
GSHEET_ID=1ABC123def456GHI789jkl
GSHEET_CREDENTIALS={"type":"service_account",...}
```

### Variables OPCIONALES:
```env
API_KEY=tu_api_key_secreta
DB_HOST=localhost
DB_PORT=5432
DB_USER=tu_usuario
DB_PASS=tu_password
DB_NAME=caja_lbj
EMAIL_HOST=smtp.gmail.com
EMAIL_USER=tu_email@gmail.com
EMAIL_PASS=tu_app_password
```

## 🔄 GitHub Actions Workflow

Crear `.github/workflows/deploy.yml`:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [ main ]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Build
      run: npm run build
    
    - name: Deploy to GitHub Pages
      uses: peaceiris/actions-gh-pages@v3
      with:
        github_token: ${{ secrets.GITHUB_TOKEN }}
        publish_dir: ./public
```

## 🐛 Solución de Problemas

### Error: "No Output Directory named 'public' found"
✅ **Solución:** Ejecutar `npm run build` antes del deploy.

### Error: "Module not found"
✅ **Solución:** Verificar que todos los archivos estén en `public/`.

### Error: "Google Sheets API"
✅ **Solución:** Configurar `GSHEET_CREDENTIALS` correctamente.

### Error: "Service Worker registration failed"
✅ **Solución:** Verificar que `service-worker.js` esté en el root de `public/`.

### Error: "Cannot find module './modules/'"
✅ **Solución:** Verificar rutas relativas en imports.

## 📊 Verificación Post-Deploy

1. **Funcionalidad básica:**
   - [ ] La página carga correctamente
   - [ ] Los formularios funcionan
   - [ ] Se pueden agregar movimientos
   - [ ] El localStorage funciona

2. **PWA:**
   - [ ] Se puede instalar como app
   - [ ] Funciona offline
   - [ ] Service Worker activo

3. **Sincronización:**
   - [ ] Se conecta a Google Sheets
   - [ ] Guarda datos correctamente
   - [ ] Muestra historial

## 🎯 Comandos Útiles

```bash
# Build local
npm run build

# Servidor de desarrollo
npm run dev

# Tests
npm test

# Deploy a Vercel
npm run deploy:vercel

# Deploy a Netlify  
npm run deploy:netlify
```

## 📞 Soporte

Si tienes problemas con el deploy:

1. Verifica que `npm run build` funcione localmente
2. Revisa las variables de entorno
3. Consulta los logs de la plataforma de deploy
4. Verifica que todas las dependencias estén instaladas

¡La aplicación debería funcionar perfectamente después del deploy! 🚀