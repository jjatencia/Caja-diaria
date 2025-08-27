#!/bin/bash

echo "🚀 Deploy manual a Vercel..."
echo "📦 Proyecto: caja-diaria-exora"
echo "🌐 URL: https://caja-diaria-exora.vercel.app"
echo ""

# Verificar que estamos en main
git checkout main
git pull origin main

echo "✅ Código actualizado"
echo ""

# Información para deploy manual
echo "📋 INSTRUCCIONES PARA DEPLOY MANUAL:"
echo ""
echo "1. Ve a: https://vercel.com/dashboard"
echo "2. Busca el proyecto: caja-diaria-exora"
echo "3. Click en 'Visit' o 'Deployments'"
echo "4. Click en 'Redeploy' del último deployment"
echo "5. O ve a Settings → Git y verifica la conexión"
echo ""

echo "🔧 VERIFICAR EN SETTINGS:"
echo "- Repository: jjatencia/Caja-diaria"
echo "- Branch: main"
echo "- Root Directory: ./"
echo "- Auto-deployments: ON"
echo ""

echo "📁 Archivos clave verificados:"
ls -la index.html styles.css vercel.json manifest.json 2>/dev/null || echo "❌ Falta algún archivo"

echo ""
echo "🎨 CAMBIOS APLICADOS:"
echo "- Header azul #555BF6"
echo "- Colores Exora sólidos"
echo "- Cache busting: ?v=vercel-exora-2024"
echo "- Estilos inline forzados"
echo ""
echo "⏱️  El deploy debería tardar 1-2 minutos una vez iniciado"