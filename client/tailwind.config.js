/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        uber: {
          black: '#000000',
          dark: '#121212',
          card: '#181818',
          cardHover: '#242424',
          border: '#2e2e2e',
          accent: '#276EF1',
          accentHover: '#1E54B7',
          green: '#06C167',
          greenHover: '#04A055',
          gold: '#FFD700',
          red: '#E11900'
        }
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'ping-slow': 'ping 2s cubic-bezier(0, 0, 0.2, 1) infinite',
      }
    },
  },
  plugins: [],
}
