import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';

export default {
  input: 'src/litellm.js',
  output: [
    {
      file: 'dist/litellm.js',
      format: 'cjs',
      exports: 'named',
      sourcemap: true
    },
    {
      file: 'dist/litellm.mjs',
      format: 'esm',
      sourcemap: true
    },
    {
      name: 'litellm',
      file: 'dist/litellm.umd.js',
      format: 'umd',
      exports: 'named',
      sourcemap: true,
      globals: {
        'cross-fetch': 'fetch'
      }
    }
  ],
  plugins: [
    resolve({
      browser: true,
      preferBuiltins: true
    }),
    commonjs()
  ],
  external: ['cross-fetch']
};