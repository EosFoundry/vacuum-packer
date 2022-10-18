import typescript from '@rollup/plugin-typescript';
import commonjs from '@rollup/plugin-commonjs'
import { nodeResolve } from '@rollup/plugin-node-resolve';

export default {
  input: '<PluginMain>',
  output: {
    file: './<PluginName>.mkshftpb.js',
    format: 'module'
  },
  plugins: [
    nodeResolve({
      exportConditions: ['node']
    }),
    commonjs()
  ]
};