# 🚀 Configuración de Vercel para Caja LBJ

## ✅ Estado del Deploy

### **Problemas Resueltos:**
- ❌ Error: `Cannot find module '/vercel/path0/scripts/build.js'`
- ❌ Error: `Function Runtimes must have a valid version`
- ✅ **Solucionado:** Configuración completamente auto-detectada

### **Configuración Final:**
- ✅ Sin `vercel.json` - auto-detección completa
- ✅ Script de build simplificado (no-op)
- ✅ APIs auto-detectadas en directorio `/api`
- ✅ Archivos estáticos servidos desde root
- ✅ Node.js 18.x especificado en engines

## 🔧 Variables de Entorno Requeridas en Vercel

Para que la aplicación funcione completamente en Vercel, configura estas variables:

### **1. Variables OBLIGATORIAS:**

```env
# Google Sheets Configuration
GSHEET_ID=tu_google_sheet_id_aqui
GSHEET_NAME=LBJ
GSHEET_TREASURY_NAME=Tesorería
GSHEET_CREDENTIALS={"type":"service_account","project_id":"tu-proyecto",...}
```

### **2. Variables OPCIONALES:**

```env
# API Key para funciones avanzadas
API_KEY=tu_api_key_secreta

# Base de Datos PostgreSQL (opcional)
DB_HOST=tu_db_host
DB_PORT=5432
DB_USER=tu_usuario_db
DB_PASS=tu_password_db
DB_NAME=caja_lbj

# Email Configuration (para alertas)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=tu_email@gmail.com
EMAIL_PASS=tu_app_password
EMAIL_FROM=tu_email@gmail.com
EMAIL_TO=destinatario@email.com
```

## 📋 Cómo Configurar Variables en Vercel

### **Método 1: Dashboard Web**
1. Ve a [vercel.com](https://vercel.com)
2. Selecciona tu proyecto "Caja-diaria"
3. Ve a **Settings** → **Environment Variables**
4. Añade cada variable con su valor

### **Método 2: Vercel CLI**
```bash
# Configurar las variables principales
vercel env add GSHEET_ID
vercel env add GSHEET_CREDENTIALS
vercel env add API_KEY

# Deploy con las nuevas variables
vercel --prod
```

### **Método 3: Archivo .env en Vercel**
```bash
# Subir un archivo .env local (no recomendado para producción)
vercel env pull .env.local
```

## 🚀 Deploy a Vercel

### **Deploy Automático (Recomendado):**
```bash
# Se despliega automáticamente con cada push a main
git push origin main
```

### **Deploy Manual:**
```bash
# Deploy directo
vercel --prod

# O usando npm script
npm run deploy:vercel
```

## 🔍 Verificación del Deploy

### **Checklist Post-Deploy:**

1. **✅ Build exitoso**
   - El build script debe ejecutarse sin errores
   - Mensaje: "No build needed for vanilla JavaScript app"

2. **✅ APIs funcionando**
   - Prueba: `https://tu-app.vercel.app/api/list-records`
   - Debe devolver datos o error de configuración

3. **✅ Variables de entorno**
   - Verifica en Vercel Dashboard → Settings → Environment Variables
   - Especialmente `GSHEET_ID` y `GSHEET_CREDENTIALS`

4. **✅ Aplicación funcional**
   - Página principal carga
   - Filtros de fecha funcionan correctamente
   - Sincronización con Google Sheets activa

## 🐛 Solución de Problemas

### **Error: "Cannot find module build.js"**
✅ **Solucionado** con el nuevo build script

### **Error: "GSHEET_CREDENTIALS missing"**
🔧 **Solución:** Configurar la variable en Vercel Dashboard

### **Error: "Failed to fetch /api/list-records"**
🔧 **Solución:** Verificar que `GSHEET_ID` esté configurado

### **Error: "Invalid credentials"**
🔧 **Solución:** Verificar formato JSON de `GSHEET_CREDENTIALS`

## 📊 Configuración Actual

```json
// Sin vercel.json - Auto-detección completa
// Vercel automáticamente:
// - Detecta funciones API en /api/*.js
// - Sirve archivos estáticos desde root
// - Usa Node.js 18.x (especificado en package.json)
// - Maneja ES modules correctamente
```

```json
// package.json - Configuración relevante
{
  "type": "module",
  "engines": {
    "node": "18.x"
  },
  "scripts": {
    "build": "node scripts/build.js"
  }
}
```

## 🎯 Estado Final Esperado

Una vez configurado correctamente:

- ✅ **URL Principal:** `https://caja-diaria.vercel.app/`
- ✅ **APIs funcionando:** `/api/list-records`, `/api/save-day`, etc.
- ✅ **Google Sheets:** Sincronización completa
- ✅ **Filtros de fecha:** Funcionando correctamente
- ✅ **Modo offline:** Fallback a localStorage si falla API

**¡El deploy debería funcionar perfectamente ahora!** 🎉