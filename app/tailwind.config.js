/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Hoher Kontrast, keine hellgrauen Schriftfarben (konzept.md Punkt 13)
        ink: '#1C1B1A',
        paper: '#FAF8F4',
        accent: '#C1443C',
        accentDark: '#8F2E28',
      },
      minHeight: {
        touch: '48px',
      },
      minWidth: {
        touch: '48px',
      },
    },
  },
  plugins: [],
}
