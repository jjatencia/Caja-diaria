/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class'],
  content: [
    './pages/**/*.{ts,tsx,js,jsx}',
    './components/**/*.{ts,tsx,js,jsx}',
    './app/**/*.{ts,tsx,js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#0B1020',
        card: '#121830',
        navbar: '#02145C',
        'brand-blue': '#555BF6',
        'brand-pink': '#FD778B',
        text: '#E6E9F2',
        border: '#02145C',
      },
      fontFamily: {
        sans: ['var(--font-sans)'],
      },
      boxShadow: {
        card: '0 2px 4px rgba(0,0,0,0.1)',
        hover: '0 4px 8px rgba(0,0,0,0.2)',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: 0, transform: 'translateY(12px)' },
          to: { opacity: 1, transform: 'translateY(0)' },
        },
      },
      animation: {
        'card-in': 'fade-in 0.2s ease-out',
      },
    },
  },
  plugins: [],
}
