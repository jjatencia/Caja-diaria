# 🚀 Configuración de GitHub Pages

## ✅ Estado Actual

- ✅ **Branch `gh-pages` creada** con todos los archivos de deploy
- ✅ **Archivos en el root** del branch (index.html, app.js, etc.)
- ✅ **Archivo `.nojekyll`** incluido
- ✅ **Scripts de deploy automatizados**

## 🔧 Configuración Manual Requerida

Para activar GitHub Pages, sigue estos pasos **UNA SOLA VEZ**:

### 1. Ve a tu repositorio en GitHub
```
https://github.com/jjatencia/Caja-diaria
```

### 2. Ve a Settings → Pages
- Clic en la pestaña **"Settings"** 
- Scroll down hasta **"Pages"** en el menú lateral

### 3. Configurar la fuente
- **Source:** Selecciona "Deploy from a branch"
- **Branch:** Selecciona "gh-pages"
- **Folder:** Selecciona "/ (root)"
- Clic en **"Save"**

### 4. Esperar 2-3 minutos
GitHub procesará el deploy y te dará una URL.

## 🌐 URL de tu aplicación

Una vez configurado, tu aplicación estará en:
```
https://jjatencia.github.io/Caja-diaria/
```

## 🔄 Deploys Futuros

Para futuras actualizaciones, usa cualquiera de estos métodos:

### Método 1: Script automático
```bash
npm run deploy:gh-pages
```

### Método 2: GitHub Actions (automático en push)
Los workflows en `.github/workflows/` se ejecutan automáticamente al hacer push a `main`.

### Método 3: Manual
```bash
npm run build
git checkout gh-pages
cp -r public/* .
git add -A
git commit -m "Update deploy"
git push origin gh-pages
git checkout main
```

## 🔍 Verificación

Para verificar que todo está correcto:

1. **Branch gh-pages existe:**
   ```bash
   git branch -a | grep gh-pages
   ```

2. **Archivos en el root:**
   ```bash
   git checkout gh-pages
   ls -la | grep index.html
   git checkout main
   ```

3. **Build funciona:**
   ```bash
   npm run build
   ls public/index.html
   ```

## 🐛 Solución de Problemas

### ❌ "Branch gh-pages no aparece en GitHub"
- Verifica que el push fue exitoso: `git branch -a`
- Refresca la página de GitHub
- Puede tardar unos minutos en aparecer

### ❌ "GitHub Pages no muestra la aplicación"
- Asegúrate de haber configurado Pages en Settings
- Verifica que `index.html` esté en el root de gh-pages
- Espera 2-3 minutos para el procesamiento

### ❌ "Errores 404 en recursos"
- Verifica que todos los archivos estén en gh-pages
- Comprueba que `.nojekyll` existe
- Los paths en el código deben ser relativos

### ❌ "La aplicación no se actualiza"
- Limpia la cache del navegador (Ctrl+Shift+R)
- Verifica que el último commit esté en gh-pages
- Haz un deploy manual: `npm run deploy:gh-pages`

## 📊 Status de Verificación

✅ Branch gh-pages creada
✅ Archivos de build copiados
✅ .nojekyll incluido
✅ Scripts de deploy listos
⚠️  **PENDIENTE: Configurar GitHub Pages en Settings**

**¡Una vez configures GitHub Pages en Settings, tu aplicación estará disponible en línea!** 🎉