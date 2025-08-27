// Deploy configuration for static hosting platforms
export default {
  // Build configuration
  build: {
    outDir: 'public',
    assets: [
      '*.html',
      '*.js', 
      '*.css',
      '*.json',
      '*.png',
      'modules/**/*',
      'utils/**/*',
      'api/**/*',
      'config/**/*'
    ]
  },
  
  // Server configuration
  server: {
    port: 8000,
    fallback: 'index.html'
  },
  
  // Environment variables needed
  env: {
    required: [
      'GSHEET_ID',
      'GSHEET_CREDENTIALS', 
      'API_KEY'
    ],
    optional: [
      'DB_HOST',
      'DB_PORT',
      'DB_USER', 
      'DB_PASS',
      'DB_NAME',
      'EMAIL_HOST',
      'EMAIL_PORT',
      'EMAIL_USER',
      'EMAIL_PASS',
      'EMAIL_FROM',
      'EMAIL_TO'
    ]
  }
};