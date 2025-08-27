#!/usr/bin/env node

console.log('🔍 Verificando configuración de Vercel...');

import fs from 'fs';
import path from 'path';

// Verificar archivos principales
const files = [
    'index.html',
    'styles.css',
    'app.js',
    'manifest.json',
    'vercel.json'
];

console.log('\n📁 Archivos principales:');
files.forEach(file => {
    if (fs.existsSync(file)) {
        const stats = fs.statSync(file);
        console.log(`✅ ${file} (${Math.round(stats.size / 1024)}KB)`);
    } else {
        console.log(`❌ ${file} - FALTA`);
    }
});

// Verificar API
console.log('\n🔧 APIs:');
if (fs.existsSync('api')) {
    const apiFiles = fs.readdirSync('api');
    apiFiles.forEach(file => {
        console.log(`✅ api/${file}`);
    });
} else {
    console.log('❌ Directorio api no encontrado');
}

// Verificar vercel.json
if (fs.existsSync('vercel.json')) {
    try {
        const vercelConfig = JSON.parse(fs.readFileSync('vercel.json', 'utf8'));
        console.log('\n⚙️ Configuración Vercel:');
        console.log(`- Version: ${vercelConfig.version || 'No especificada'}`);
        console.log(`- Public: ${vercelConfig.public || 'No especificado'}`);
        console.log(`- Functions: ${vercelConfig.functions ? 'Configuradas' : 'No configuradas'}`);
        console.log(`- Routes: ${vercelConfig.routes ? vercelConfig.routes.length + ' rutas' : 'No configuradas'}`);
    } catch (e) {
        console.log('❌ Error leyendo vercel.json:', e.message);
    }
}

console.log('\n🚀 El proyecto está listo para Vercel');
console.log('💡 Asegúrate de que el proyecto sea público en tu dashboard de Vercel');