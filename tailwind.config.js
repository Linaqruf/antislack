/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{html,ts,tsx,js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Backgrounds
        bg: {
          primary: '#0D0D0D',
          secondary: '#141414',
          tertiary: '#1A1A1A',
        },
        // Foreground
        fg: {
          primary: '#FFFFFF',
          secondary: '#999999',
          muted: '#666666',
        },
        // Accent - Electric Lime
        accent: {
          DEFAULT: '#BFFF00',
          dim: '#8FB300',
          glow: 'rgba(191, 255, 0, 0.4)',
        },
        // Semantic
        danger: '#FF3333',
        warning: '#FFB000',
        success: '#00FF66',
        // Borders
        border: {
          DEFAULT: '#333333',
          focus: '#BFFF00',
        },
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', '"Fira Code"', '"SF Mono"', 'Consolas', 'monospace'],
      },
      fontSize: {
        'xs': ['10px', { lineHeight: '1.4', letterSpacing: '0.1em' }],
        'sm': ['12px', { lineHeight: '1.5', letterSpacing: '0.05em' }],
        'base': ['14px', { lineHeight: '1.6', letterSpacing: '0.02em' }],
        'lg': ['16px', { lineHeight: '1.5', letterSpacing: '0.02em' }],
        'xl': ['20px', { lineHeight: '1.3', letterSpacing: '0.05em' }],
        '2xl': ['28px', { lineHeight: '1.2', letterSpacing: '0.05em' }],
        '3xl': ['40px', { lineHeight: '1.1', letterSpacing: '0' }],
      },
      spacing: {
        '0': '0',
        '1': '4px',
        '2': '8px',
        '3': '12px',
        '4': '16px',
        '5': '20px',
        '6': '24px',
        '8': '32px',
        '10': '40px',
        '12': '48px',
        '16': '64px',
      },
      boxShadow: {
        'glow': '0 0 20px rgba(191, 255, 0, 0.4)',
        'glow-sm': '0 0 8px rgba(191, 255, 0, 0.4)',
        'glow-lg': '0 0 30px rgba(191, 255, 0, 0.5)',
      },
      animation: {
        'fade-up': 'fade-up 0.2s ease-out',
        'pulse': 'pulse 2s ease-in-out infinite',
        'shake': 'shake 0.4s ease-in-out',
        'scan': 'scan 8s linear infinite',
      },
      keyframes: {
        'fade-up': {
          'from': { opacity: '0', transform: 'translateY(8px)' },
          'to': { opacity: '1', transform: 'translateY(0)' },
        },
        'pulse': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
        'shake': {
          '0%, 100%': { transform: 'translateX(0)' },
          '20%, 60%': { transform: 'translateX(-4px)' },
          '40%, 80%': { transform: 'translateX(4px)' },
        },
        'scan': {
          'from': { transform: 'translateY(-100%)' },
          'to': { transform: 'translateY(100vh)' },
        },
      },
      borderRadius: {
        'none': '0',
      },
    },
  },
  plugins: [],
};
