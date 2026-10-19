import { Application } from '@hotwired/stimulus'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import DisclosureController from '../../../app/frontend/controllers/disclosure_controller'

// 防回归:移动端导航面板必须通过切换 Tailwind `hidden` 工具类来显隐,
// 而不是切换 `hidden` HTML 属性(属性与类互不影响,会让移动端菜单打不开)。
describe('disclosure controller', () => {
  let application: Application
  let button: HTMLButtonElement
  let panel: HTMLElement

  beforeEach(async () => {
    document.body.innerHTML = `
      <div data-controller="disclosure">
        <button type="button" data-disclosure-target="trigger" data-action="click->disclosure#toggle" aria-expanded="false">Menu</button>
        <nav data-disclosure-target="panel" class="hidden"></nav>
      </div>
    `
    button = document.querySelector('button') as HTMLButtonElement
    panel = document.querySelector('nav') as HTMLElement
    application = Application.start()
    application.register('disclosure', DisclosureController)
    await new Promise((resolve) => requestAnimationFrame(resolve))
  })

  afterEach(() => {
    void application.stop()
    document.body.innerHTML = ''
  })

  it('starts with the panel hidden and aria-expanded false', () => {
    expect(panel.classList.contains('hidden')).toBe(true)
    expect(button.getAttribute('aria-expanded')).toBe('false')
    expect(panel.hasAttribute('aria-hidden')).toBe(false)
  })

  it('opens the panel and reflects state on the first toggle', () => {
    button.click()
    expect(panel.classList.contains('hidden')).toBe(false)
    expect(button.getAttribute('aria-expanded')).toBe('true')
  })

  it('closes the panel again on the second toggle', () => {
    button.click()
    button.click()
    expect(panel.classList.contains('hidden')).toBe(true)
    expect(button.getAttribute('aria-expanded')).toBe('false')
    expect(panel.hasAttribute('aria-hidden')).toBe(false)
  })
})
