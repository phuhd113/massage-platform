import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef7f5',
          100: '#d3ebe6',
          500: '#0f6b5f',
          600: '#0b544a',
          700: '#083f38',
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
