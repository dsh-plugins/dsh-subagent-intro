import { fileURLToPath } from 'node:url'

/** 由宿主客户端模块表提供的共享模块，必须保持 external，禁止打进产物。 */
const CLIENT_EXTERNALS = [
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  '@deepseek-ai/cordis',
]

export default {
  entry: { client: fileURLToPath(new URL('./src/client/index.tsx', import.meta.url)) },
  outDir: fileURLToPath(new URL('./lib', import.meta.url)),
  format: 'cjs',
  target: 'es2022',
  dts: false,
  sourcemap: false,
  clean: false,
  external: [...CLIENT_EXTERNALS],
  noExternal: (specifier) => (CLIENT_EXTERNALS.includes(specifier) ? undefined : true),
  inputOptions: {
    platform: 'browser',
    resolve: {
      conditionNames: ['browser', 'import', 'require', 'default'],
    },
  },
  outputOptions: {
    entryFileNames: 'client.js',
    banner: 'window.__ModuleLoader__.load({ id: "dsh-subagent-intro", factory: (require) => {',
    footer: 'return module.exports; } });',
    intro: 'var module = { exports: {} }; var exports = module.exports;',
    codeSplitting: false,
  },
}
