import { Controller } from '@hotwired/stimulus'

export default class extends Controller<HTMLSelectElement> {
  navigate() {
    const url = this.element.value
    if (url) window.location.href = url
  }
}
