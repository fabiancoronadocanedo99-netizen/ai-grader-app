import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        'primary': '#e0e5ec',
        'primary-dark': '#a3b1c6',
        'primary-light': '#ffffff',
      },
      boxShadow: {
        'neu': '9px 9px 16px #a3b1c6, -9px -9px 16px #ffffff',
        'neu-inset': 'inset 5px 5px 10px #a3b1c6, inset -5px -5px 10px #ffffff',
      },
    },
  },
  plugins: [],
};
export default config;