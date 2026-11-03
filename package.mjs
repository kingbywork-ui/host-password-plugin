import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'

const manifest = JSON.parse(await readFile('plugin.json', 'utf8'))
const filename = `${manifest.id}-${manifest.version}.tgz`
const result = spawnSync('tar', ['-czf', filename, '-C', 'dist', 'index.js', 'sandbox.html', 'plugin.json'], { stdio: 'inherit' })
if (result.status !== 0) throw new Error(`plugin packaging failed: ${result.error?.message ?? result.status}`)
const sha256 = createHash('sha256').update(await readFile(filename)).digest('hex')
await writeFile(`${filename}.sha256`, `${sha256}  ${filename}\n`)
console.log(`Created ${filename}; SHA-256 ${sha256}`)
