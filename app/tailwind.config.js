/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Neutrale Palette aus dem UI-Konzept. Jede Textfarbe erreicht auf `paper`
        // mindestens 4,5:1 (WCAG AA) - keine hellgrauen Schriftfarben, konzept.md Punkt 13.
        paper: '#F4F3EF',
        ink: '#1A1A17', // 15,7:1
        muted: '#625F57', // Sekundärtext, 5,7:1
        feld: '#8A877E', // Unterlinie von Eingabefeldern, 3,2:1 (WCAG 1.4.11)
        linie: '#D3D0C6', // Trennlinien zwischen Angebotszeilen, rein dekorativ
        // Hinterlegung der Produktbilder, eine Farbe pro Händler. Trägt nie Text.
        pastell: {
          sand: '#EDE4D4',
          mint: '#DCEBE0',
          butter: '#F2E8C9',
          himmel: '#DCE5F0',
          blush: '#F0DFDB',
          flieder: '#E4E0EE',
          salbei: '#DDE8E6',
          rose: '#EEE1EA',
        },
      },
      fontFamily: {
        // Systemschrift: SF Pro auf Apple-Geräten, Roboto/Segoe auf den anderen.
        // Nichts wird nachgeladen.
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"SF Pro Text"',
          'system-ui',
          '"Segoe UI"',
          'Roboto',
          'sans-serif',
        ],
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
