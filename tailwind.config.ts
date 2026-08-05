import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{js,ts,jsx,tsx}', './components/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0d0d18',
        panel: '#1a1a2e',
      },
    },
  },
  plugins: [],
};

export default config;
