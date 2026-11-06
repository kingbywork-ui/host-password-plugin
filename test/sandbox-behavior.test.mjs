import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import vm from 'node:vm'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const html = readFileSync(path.join(root, 'sandbox.html'), 'utf8')
const plugin = JSON.parse(readFileSync(path.join(root, 'plugin.json'), 'utf8'))
const readme = readFileSync(path.join(root, 'README.md'), 'utf8')

const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/)
assert.ok(scriptMatch, 'sandbox.html contains an inline script')
const scriptText = scriptMatch[1]

// Static contract checks that do not need a DOM.
assert.ok(html.includes('<option value="generate">生成密钥</option>'), 'generate mode option exists')
assert.ok(html.includes('<option value="rotate">轮换密钥</option>'), 'rotate mode option exists')
assert.ok(html.includes('不禁用服务器密码'), 'key instructions say server passwords stay enabled')
assert.ok(html.includes('保留其他授权密钥') || html.includes('保留'), 'key instructions keep other authorized keys')
assert.deepEqual(plugin.permissions, ['panel:register', 'hostPassword.rotate'], 'permissions reuse hostPassword.rotate only')
assert.deepEqual(plugin.capabilities, ['ui.panel.register', 'hostPassword.rotate'], 'capabilities reuse hostPassword.rotate only')
assert.ok(!JSON.stringify(plugin).toLowerCase().includes('privatekey') && !JSON.stringify(plugin).toLowerCase().includes('private-key'), 'manifest never exposes a private-key capability')
assert.ok(readme.includes('hostKey'), 'README documents the hostKey gateway')

// Minimal DOM shim sufficient to execute the sandbox script and observe its RPC routing.
const elementIds = new Set([
  'notice', 'mode', 'passwordRules', 'keyInfo', 'keyTitle', 'keyOperationHint', 'recoveryHint',
  'heading', 'intro', 'start', 'historyBtn', 'history', 'passwordExport', 'export',
  'group', 'search', 'accounts', 'all', 'scopeCount', 'selectedCount', 'compatibilityHint',
  'unlock', 'refresh', 'recover', 'recoverOther', 'recoveryAccount', 'clearSelection', 'cancel',
  'includePasswords', 'results', 'recoveryOnly', 'recoverySummary',
  'length', 'repeat', 'digits', 'lower', 'upper', 'symbols', 'excluded', 'same', 'prefix',
])
function makeElement (tagName = 'div') {
  const element = {
    tagName, value: '', checked: false, disabled: false, hidden: false, indeterminate: false,
    textContent: '', title: '', name: '', type: '', className: '', dataset: {}, style: {},
    children: [],
    classList: {
      names: new Set(),
      toggle (name, force) { const on = force === undefined ? !this.names.has(name) : !!force; if (on) this.names.add(name); else this.names.delete(name); return on },
      add (name) { this.names.add(name) },
      remove (name) { this.names.delete(name) },
      contains (name) { return this.names.has(name) },
    },
    replaceChildren (...nodes) { this.children = nodes.length ? [...nodes] : [] },
    append (...nodes) { this.children.push(...nodes) },
    appendChild (node) { this.children.push(node); return node },
    setAttribute () {}, getAttribute () { return null },
    matches () { return false },
    dispatchEvent () { return false },
  }
  Object.defineProperty(element, 'options', { get () { return element.children.filter(child => child.tagName === 'option') } })
  return element
}

const elements = new Map()
for (const id of elementIds) elements.set(id, makeElement('div'))
const documentElement = makeElement('html')
const document = {
  documentElement,
  getElementById: id => elements.get(id) || (elements.set(id, makeElement('div')), elements.get(id)),
  createElement: tagName => makeElement(tagName),
  querySelectorAll: () => [],
}
const listeners = { message: [], keydown: [], beforeunload: [] }
const log = []
const listPayload = () => ({
  encrypted: true, unlocked: true, groups: [],
  profiles: [
    { id: 'pw1', name: 'web', host: '192.0.2.10', port: 22, user: 'root', group: 'g1', auth: 'password', hasPassword: true, hasPrivateKey: false, pending: false },
    { id: 'key1', name: 'db', host: '192.0.2.11', port: 22, user: 'root', group: 'g1', auth: 'publicKey', hasPassword: false, hasPrivateKey: true, pending: false },
  ],
})
let failKeyList = false
let omitGroups = false
const route = method => {
  if (method === 'hostPassword.list') return { ok: true, result: listPayload() }
  if (method === 'hostKey.list') {
    if (failKeyList) return { ok: false, error: 'fixture hostKey list failed' }
    const payload = listPayload()
    return omitGroups ? { ok: true, result: { encrypted: true, unlocked: true, profiles: payload.profiles } } : { ok: true, result: payload }
  }
  if (method === 'hostKey.start') return { ok: true, result: { jobId: 'job-1' } }
  if (method === 'hostKey.status') return { ok: true, result: { done: true, rows: [] } }
  if (method === 'hostPassword.unlock') return { ok: true, result: { unlocked: true } }
  return { ok: false, error: 'unexpected method ' + method }
}
const dispatchMessage = data => { for (const handler of listeners.message) handler({ source: parent, data }) }
const parent = {
  postMessage (data) {
    if (data && data.channel === 'issh-plugin-rpc' && data.method === 'gateway.request') {
      const method = data.params.method
      log.push(method)
      const response = route(method)
      dispatchMessage({ channel: 'issh-plugin-rpc', id: data.id, ok: response.ok, result: response.result, error: response.error })
    } else if (data && data.channel === 'issh-plugin-panel') {
      log.push('panel:' + data.action)
    }
  },
}
const context = vm.createContext({
  document, parent, location: { hash: '' },
  addEventListener: (type, handler) => { (listeners[type] || (listeners[type] = [])).push(handler) },
  setTimeout, clearTimeout, console,
})
const tick = () => new Promise(resolve => setImmediate(resolve))

vm.runInContext(scriptText, context)
await tick()
assert.ok(log.includes('hostPassword.list'), 'the sandbox reads the password list on load')
assert.equal(elements.get('start').textContent, '修改选中账户', 'password mode keeps the batch-password label')
assert.equal(elements.get('passwordRules').hidden, false, 'password mode keeps rules visible')
assert.equal(elements.get('keyInfo').hidden, true, 'password mode hides key instructions')

// Switch to generate mode and observe hostKey routing plus the key-specific chrome.
elements.get('mode').value = 'generate'
elements.get('mode').onchange()
await tick()
assert.ok(log.includes('hostKey.list'), 'generate mode routes to hostKey.list')
assert.equal(elements.get('start').textContent, '生成密钥并切换认证', 'generate mode labels its primary action')
assert.equal(elements.get('passwordRules').hidden, true, 'generate mode hides password rules')
assert.equal(elements.get('keyInfo').hidden, false, 'generate mode shows key instructions')
assert.equal(elements.get('historyBtn').hidden, true, 'generate mode hides password history')
assert.equal(elements.get('export').hidden, true, 'generate mode hides password export')

// A failing hostKey.list must fail closed with a clear message, never a silent success.
failKeyList = true
elements.get('refresh').onclick()
await tick()
assert.ok(elements.get('notice').textContent.includes('密钥操作失败'), 'a failing hostKey list reports a key operation error')
assert.ok(elements.get('notice').textContent.includes('hostKey'), 'the failure message names hostKey so the user knows what to update')
assert.equal(elements.get('start').disabled, true, 'a failing hostKey list disables the primary action')
assert.equal(log.filter(method => method === 'hostKey.start').length, 0, 'a failing hostKey list never starts a job')

// An old host that omits the groups array must also fail closed rather than silently succeed.
failKeyList = false
omitGroups = true
elements.get('refresh').onclick()
await tick()
assert.ok(elements.get('notice').textContent.includes('接口契约'), 'a hostKey list missing groups fails the contract check')
assert.ok(elements.get('notice').textContent.includes('密钥操作失败'), 'the contract failure is reported as a key operation error')

// Switching back to password mode must route to hostPassword again.
omitGroups = false
elements.get('mode').value = 'password'
elements.get('mode').onchange()
await tick()
assert.equal(log.filter(method => method === 'hostPassword.list').length >= 2, true, 'password mode keeps routing to hostPassword.list')
assert.equal(elements.get('start').textContent, '修改选中账户', 'returning to password mode restores the batch-password label')

console.log(`sandbox-behavior: ${log.length} routed RPC calls verified (hostPassword/hostKey routing, key chrome, fail-closed list and old-host contract errors)`)
