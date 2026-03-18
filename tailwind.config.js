export default {
  content: ['./index.html', './src/**/*.{ts,tsx,css}'],
  theme: {
    extend: {
      colors: {
        primary: 'var(--color-primary)',
        info: 'var(--color-info)',
        bg: 'var(--color-bg)',
        bg2: 'var(--color-bg-2)',
        bg3: 'var(--color-bg-3)',
        surface: 'var(--color-surface)',
        surface2: 'var(--color-surface-2)',
        surface3: 'var(--color-surface-3)',
        text: 'var(--color-text)',
        muted: 'var(--color-muted)',
        success: 'var(--color-success)',
        warning: 'var(--color-warning)',
        danger: 'var(--color-danger)',
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        pill: 'var(--radius-pill)',
      },
      boxShadow: {
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
        lime: 'var(--glow-lime)',
        cyan: 'var(--glow-cyan)',
        purple: 'var(--glow-purple)',
      },
      fontFamily: {
        sans: 'var(--font-family-base)',
      },
    },
  },
};
