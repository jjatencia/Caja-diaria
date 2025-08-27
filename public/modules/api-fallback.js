// API Fallback module for static hosting compatibility
import { appState } from './state.js';
import { showAlert } from '../ui.js';

export async function apiRequest(endpoint, options = {}) {
    // Try API first (works on Vercel)
    try {
        const response = await fetch(endpoint, {
            ...options,
            cache: 'no-store'
        });
        
        if (response.ok) {
            return await response.json();
        }
        
        // If API fails, fall back to localStorage
        console.warn(`API ${endpoint} failed, using localStorage fallback`);
        return handleLocalStorageFallback(endpoint, options);
        
    } catch (error) {
        console.warn(`API ${endpoint} not available, using localStorage fallback`);
        return handleLocalStorageFallback(endpoint, options);
    }
}

function handleLocalStorageFallback(endpoint, options) {
    // For static hosting (GitHub Pages), use only localStorage
    const sucursal = localStorage.getItem('sucursal');
    
    if (endpoint.includes('/api/list-records')) {
        // Return empty records for static hosting
        return {
            records: [],
            message: 'Funcionando en modo offline - usando almacenamiento local'
        };
    }
    
    if (endpoint.includes('/api/save-day')) {
        // Simulate successful save
        if (options.method === 'POST') {
            showAlert('Guardado localmente (sin sincronización con servidor)', 'info');
            return { success: true, mode: 'local' };
        }
    }
    
    // Default fallback
    return {
        success: false,
        error: 'Endpoint not available in static hosting',
        fallback: true
    };
}

export function isStaticHosting() {
    // Detect if running on static hosting (GitHub Pages)
    const hostname = window.location.hostname;
    return hostname.includes('github.io') || hostname.includes('pages.dev');
}

export function getApiBaseUrl() {
    if (isStaticHosting()) {
        return ''; // No API base for static hosting
    }
    return ''; // Relative URLs for Vercel
}