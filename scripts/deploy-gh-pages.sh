#!/bin/bash

# Script para deploy manual a gh-pages
# Uso: ./scripts/deploy-gh-pages.sh

set -e

echo "🚀 Iniciando deploy a gh-pages..."

# 1. Asegurar que estamos en main
git checkout main

# 2. Hacer build
echo "📦 Ejecutando build..."
npm run build

# 3. Cambiar a gh-pages (crearla si no existe)
if git show-ref --verify --quiet refs/heads/gh-pages; then
  echo "📂 Cambiando a branch gh-pages existente..."
  git checkout gh-pages
else
  echo "📂 Creando nueva branch gh-pages..."
  git checkout --orphan gh-pages
fi

# 4. Limpiar archivos anteriores (excepto .git)
echo "🧹 Limpiando archivos anteriores..."
find . -maxdepth 1 ! -name '.git' ! -name '.' ! -name '..' -exec rm -rf {} \;

# 5. Copiar archivos del build
echo "📁 Copiando archivos del build..."
git checkout main -- public
cp -r public/* .
rm -rf public/

# 6. Crear .nojekyll si no existe
touch .nojekyll

# 7. Commit y push
echo "💾 Haciendo commit y push..."
git add -A
git commit -m "Deploy: $(date '+%Y-%m-%d %H:%M:%S')" || echo "No hay cambios para commitear"
git push origin gh-pages

# 8. Volver a main
git checkout main

echo "✅ Deploy completado!"
echo "🌐 Tu sitio estará disponible en: https://jjatencia.github.io/Caja-diaria/"
echo "⚠️  Nota: Si es la primera vez, necesitas configurar GitHub Pages en Settings → Pages"