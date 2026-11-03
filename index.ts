import manifest from './plugin.json'

export { manifest }
export default {
    manifest,
    activate (ctx: { gateway: { ui: { registerSandboxPanel: (panel: unknown) => void } } }) {
        ctx.gateway.ui.registerSandboxPanel({
            id: 'host-password', title: '批量修改主机密码', placement: 'modal',
            sandboxUrl: 'sandbox.html', sandboxOrigin: '',
        })
    },
}
