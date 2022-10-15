import typescript from '@rollup/plugin-typescript';
import commonjs from '@rollup/plugin-commonjs'
import { nodeResolve } from '@rollup/plugin-node-resolve';

export default {
  input: 'index.ts',
  output: {
    file: './lib/index.js',
    format: 'module'
  },
  plugins: [
    typescript(),
    nodeResolve({
      exportConditions: ['node']
    }),
    commonjs()
  ]
};