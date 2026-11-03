import { copyFileSync } from 'node:fs'
import { resolve } from 'node:path'

export default {
    plugins: [{ name: 'copy-panel', closeBundle () { copyFileSync(resolve('sandbox.html'), resolve('dist/sandbox.html')); copyFileSync(resolve('plugin.json'), resolve('dist/plugin.json')) } }],
    build: { lib: { entry: resolve('index.ts'), formats: ['es'], fileName: () => 'index.js' }, target: 'es2022', minify: false },
}
