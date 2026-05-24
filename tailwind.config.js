module.exports = {
  content: [
    "./pages/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}"
  ],
  theme: {
    extend: {
      colors: {
        lofi: {
          bg: '#1f1814',
          card: 'rgba(45, 35, 28, 0.72)',
          warm: '#ffb347',
          cool: '#6b7b4c',
          text: '#fff9f0',
          muted: '#a89480',
        }
      }
    }
  },
  plugins: [],
}
