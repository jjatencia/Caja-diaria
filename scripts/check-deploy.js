#!/usr/bin/env node

import { promises as fs } from 'fs';
import path from 'path';

const PUBLIC_DIR = 'public';
const REQUIRED_FILES = [
  'index.html',
  'app.js',
  'ui.js',
  'storage.js',
  'service-worker.js',
  'styles.css',
  'manifest.json',
  'icon-180.png'
];

const REQUIRED_DIRS = [
  'modules',
  'utils',
  'api'
];

async function checkFile(filePath) {
  try {
    const stat = await fs.stat(filePath);
    return stat.isFile();
  } catch {
    return false;
  }
}

async function checkDir(dirPath) {
  try {
    const stat = await fs.stat(dirPath);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

async function checkDeploy() {
  console.log('🔍 Verificando configuración de deploy...\n');
  
  let allGood = true;
  
  // Check if public directory exists
  const publicExists = await checkDir(PUBLIC_DIR);
  if (!publicExists) {
    console.log('❌ Directorio public/ no encontrado');
    console.log('   💡 Ejecuta: npm run build');
    allGood = false;
  } else {
    console.log('✅ Directorio public/ existe');
  }
  
  // Check required files
  console.log('\n📄 Verificando archivos requeridos:');
  for (const file of REQUIRED_FILES) {
    const filePath = path.join(PUBLIC_DIR, file);
    const exists = await checkFile(filePath);
    if (exists) {
      console.log(`✅ ${file}`);
    } else {
      console.log(`❌ ${file} - FALTANTE`);
      allGood = false;
    }
  }
  
  // Check required directories
  console.log('\n📁 Verificando directorios requeridos:');
  for (const dir of REQUIRED_DIRS) {
    const dirPath = path.join(PUBLIC_DIR, dir);
    const exists = await checkDir(dirPath);
    if (exists) {
      console.log(`✅ ${dir}/`);
    } else {
      console.log(`❌ ${dir}/ - FALTANTE`);
      allGood = false;
    }
  }
  
  // Check configuration files
  console.log('\n⚙️  Verificando archivos de configuración:');
  
  const configFiles = [
    { file: 'vercel.json', desc: 'Configuración para Vercel' },
    { file: 'netlify.toml', desc: 'Configuración para Netlify' },
    { file: '.github/workflows/deploy.yml', desc: 'GitHub Actions' },
    { file: 'DEPLOY.md', desc: 'Documentación de deploy' }
  ];
  
  for (const { file, desc } of configFiles) {
    const exists = await checkFile(file);
    if (exists) {
      console.log(`✅ ${file} - ${desc}`);
    } else {
      console.log(`⚠️  ${file} - ${desc} (opcional)`);
    }
  }
  
  // Summary
  console.log('\n' + '='.repeat(50));
  if (allGood) {
    console.log('🎉 ¡Todo listo para deploy!');
    console.log('\n🚀 Comandos de deploy disponibles:');
    console.log('   • npm run deploy:vercel    (Vercel)');
    console.log('   • npm run deploy:netlify   (Netlify)');
    console.log('   • git push                 (GitHub Pages)');
  } else {
    console.log('❌ Hay problemas que resolver antes del deploy');
    console.log('\n🔧 Pasos recomendados:');
    console.log('   1. npm run build');
    console.log('   2. npm run check-deploy');
    console.log('   3. Proceder con el deploy');
  }
  console.log('='.repeat(50));
  
  process.exit(allGood ? 0 : 1);
}

checkDeploy().catch(error => {
  console.error('❌ Error durante la verificación:', error);
  process.exit(1);
});