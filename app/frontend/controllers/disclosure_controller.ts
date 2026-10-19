import { Controller } from '@hotwired/stimulus'

// 切换移动端导航面板的可见性。
// 面板通过 Tailwind `hidden` 工具类隐藏,因此这里也必须切换同类,
// 而不是 `hidden` HTML 属性(属性与类互不影响,会导致移动端菜单打不开)。
// 桌面端 `md:block` 在媒体查询中后置,优先级高于 `hidden` 类,始终可见;
// 不额外写 `aria-hidden`,避免移动端状态在切换到桌面后把可见导航留在无障碍树外。
export default class extends Controller<HTMLElement> {
  static targets = ['panel', 'trigger']

  declare readonly panelTarget: HTMLElement
  declare readonly triggerTarget: HTMLButtonElement

  toggle() {
    const willShow = this.panelTarget.classList.contains('hidden')
    this.panelTarget.classList.toggle('hidden', !willShow)
    this.triggerTarget.setAttribute('aria-expanded', willShow ? 'true' : 'false')
  }
}
