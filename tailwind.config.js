/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          50: '#eef0f7',
          100: '#d6dbec',
          200: '#adb7d9',
          300: '#8493c6',
          400: '#5b6fb3',
          500: '#3a4a8f',
          600: '#2a3670',
          700: '#1f2a5e',
          800: '#161f4a',
          900: '#0f1638',
          950: '#0a0f28',
        },
        accent: {
          50: '#f4f9e9',
          100: '#e5f2c9',
          200: '#cce599',
          300: '#aed85f',
          400: '#93c93a',
          500: '#7cb02a',
          600: '#628b20',
          700: '#4b6a1a',
          800: '#3d551a',
          900: '#34481b',
        },
        amber: {
          50: '#fff8ec',
          100: '#ffecc9',
          200: '#ffd68d',
          300: '#ffbb50',
          400: '#ffa324',
          500: '#f7920f',
          600: '#db6f09',
          700: '#b6500b',
          800: '#933e10',
          900: '#783410',
        },
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['"Plus Jakarta Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 2px 8px 0 rgb(15 22 56 / 0.06)',
        card: '0 8px 30px -8px rgb(15 22 56 / 0.15)',
        'card-hover': '0 16px 40px -12px rgb(15 22 56 / 0.22)',
      },
      borderRadius: {
        xl2: '1.25rem',
      },
      animation: {
        'fade-in-up': 'fadeInUp 0.6s ease-out both',
        'fade-in': 'fadeIn 0.5s ease-out both',
        float: 'float 3s ease-in-out infinite',
      },
      keyframes: {
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        },
      },
    },
  },
  plugins: [],
};
