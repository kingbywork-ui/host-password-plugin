import manifest from './plugin.json'

export { manifest }
export default {
    manifest,
    activate (ctx: { gateway: { ui: { registerSandboxPanel: (panel: unknown) => void } } }) {
        ctx.gateway.ui.registerSandboxPanel({
            id: 'host-password', title: '主机认证管理', placement: 'modal',
            sandboxUrl: 'sandbox.html', sandboxOrigin: '',
        })
    },
}
