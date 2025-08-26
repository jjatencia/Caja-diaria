#!/usr/bin/env node

import { promises as fs } from 'fs';
import path from 'path';

const PUBLIC_DIR = 'public';
const FILES_TO_COPY = [
  'index.html',
  'app.js',
  'ui.js', 
  'storage.js',
  'service-worker.js',
  'styles.css',
  'manifest.json',
  'icon-180.png',
  'package.json'
];

const DIRS_TO_COPY = [
  'modules',
  'utils',
  'api',
  'config'
];

async function createPublicDir() {
  try {
    await fs.mkdir(PUBLIC_DIR, { recursive: true });
    console.log(`✅ Created ${PUBLIC_DIR} directory`);
  } catch (error) {
    console.error(`❌ Error creating ${PUBLIC_DIR}:`, error.message);
    process.exit(1);
  }
}

async function copyFile(src, dest) {
  try {
    await fs.copyFile(src, dest);
    console.log(`📄 Copied ${src} -> ${dest}`);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error(`❌ Error copying ${src}:`, error.message);
    }
  }
}

async function copyDirectory(src, dest) {
  try {
    await fs.mkdir(dest, { recursive: true });
    const items = await fs.readdir(src);
    
    for (const item of items) {
      const srcPath = path.join(src, item);
      const destPath = path.join(dest, item);
      const stat = await fs.stat(srcPath);
      
      if (stat.isDirectory()) {
        await copyDirectory(srcPath, destPath);
      } else {
        await copyFile(srcPath, destPath);
      }
    }
    console.log(`📁 Copied directory ${src} -> ${dest}`);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error(`❌ Error copying directory ${src}:`, error.message);
    }
  }
}

async function build() {
  console.log('🚀 Starting build process...');
  
  // Create public directory
  await createPublicDir();
  
  // Copy individual files
  for (const file of FILES_TO_COPY) {
    await copyFile(file, path.join(PUBLIC_DIR, file));
  }
  
  // Copy directories
  for (const dir of DIRS_TO_COPY) {
    await copyDirectory(dir, path.join(PUBLIC_DIR, dir));
  }
  
  console.log('✅ Build completed successfully!');
  console.log(`📦 Output directory: ${PUBLIC_DIR}/`);
}

build().catch(error => {
  console.error('❌ Build failed:', error);
  process.exit(1);
});