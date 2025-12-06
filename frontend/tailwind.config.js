/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        'display': ['Orbitron', 'sans-serif'],
        'body': ['Rajdhani', 'sans-serif'],
      },
      colors: {
        // Cyberpunk/gaming color palette
        'cyber': {
          50: '#f0fdfa',
          100: '#ccfbf1',
          200: '#99f6e4',
          300: '#5eead4',
          400: '#2dd4bf',
          500: '#14b8a6',
          600: '#0d9488',
          700: '#0f766e',
          800: '#115e59',
          900: '#134e4a',
          950: '#042f2e',
        },
        'neon': {
          pink: '#ff2a6d',
          blue: '#05d9e8',
          purple: '#d300c5',
          green: '#39ff14',
          yellow: '#fffc00',
          orange: '#ff6b35',
        },
        'dark': {
          900: '#0a0a0f',
          800: '#12121a',
          700: '#1a1a25',
          600: '#252532',
          500: '#32324a',
        },
      },
      boxShadow: {
        'neon-blue': '0 0 5px #05d9e8, 0 0 20px #05d9e8, 0 0 40px #05d9e8',
        'neon-green': '0 0 5px #39ff14, 0 0 20px #39ff14, 0 0 40px #39ff14',
        'neon-pink': '0 0 5px #ff2a6d, 0 0 20px #ff2a6d, 0 0 40px #ff2a6d',
        'glow': '0 0 15px rgba(5, 217, 232, 0.5)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'scan': 'scan 3s linear infinite',
        'float': 'float 6s ease-in-out infinite',
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: '0 0 5px #05d9e8, 0 0 10px #05d9e8' },
          '100%': { boxShadow: '0 0 10px #05d9e8, 0 0 20px #05d9e8, 0 0 30px #05d9e8' },
        },
        scan: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
      },
      backgroundImage: {
        'grid-pattern': `linear-gradient(rgba(5, 217, 232, 0.03) 1px, transparent 1px),
                         linear-gradient(90deg, rgba(5, 217, 232, 0.03) 1px, transparent 1px)`,
        'cyber-gradient': 'linear-gradient(135deg, #0a0a0f 0%, #1a1a25 50%, #0a0a0f 100%)',
      },
    },
  },
  plugins: [],
}





