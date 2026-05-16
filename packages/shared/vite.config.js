export default /** @type {import('vite').UserConfig} */
({
  build: {
    ssr: true,
    sourcemap: false,
    outDir: 'dist',
    target: 'node20',
    lib: {
      entry: 'src/index.ts',
      formats: ['es'],
    },
    rollupOptions: {
      output: {
        entryFileNames: '[name].js',
      },
    },
    emptyOutDir: true,
    reportCompressedSize: false,
  },
});
