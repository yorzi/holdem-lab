import '@hotwired/turbo-rails'
import { createRoot } from 'react-dom/client'
import { StrictMode } from 'react'
import '../controllers'
import { TELEMETRY_SCHEMA_VERSION, trackTelemetry } from '../telemetry/events'
import { getDocumentLocale, type UiLocale } from '../holdem/ui/localization'

function ReactSmoke({ locale }: { readonly locale: UiLocale }) {
  return (
    <div
      className="flex items-center gap-3 rounded-full border border-moss/30 bg-moss/10 px-4 py-2 text-sm font-medium text-moss"
      data-testid="react-smoke"
      role="status"
    >
      <span aria-hidden="true" className="h-2 w-2 rounded-full bg-moss" />
      {locale === 'zh' ? 'React 训练模块已就绪' : 'React training island ready'}
    </div>
  )
}

async function mountTrainer(mount: HTMLElement) {
  if (mount.dataset.mounted === 'true' || mount.dataset.mounted === 'loading') return

  mount.dataset.mounted = 'loading'
  const locale = getDocumentLocale()
  try {
    const { default: TrainerApp } = await import('../holdem/ui/TrainerApp')
    if (!mount.isConnected) return
    mount.dataset.mounted = 'true'
    createRoot(mount).render(
      <StrictMode>
        <TrainerApp importEnabled={mount.dataset.importEnabled === 'true'} locale={locale} />
      </StrictMode>,
    )
    trackTelemetry({ schemaVersion: TELEMETRY_SCHEMA_VERSION, name: 'practice_start', mode: 'live' })
  } catch (error) {
    mount.dataset.mounted = 'error'
    mount.textContent = error instanceof Error
      ? `${locale === 'zh' ? 'Trainer 加载失败' : 'Trainer failed to load'}: ${error.message}`
      : locale === 'zh' ? 'Trainer 加载失败。' : 'Trainer failed to load.'
  }
}

function mountReactIsland() {
  const trainerMount = document.querySelector<HTMLElement>('[data-hm-trainer-mount]')
  if (trainerMount) {
    void mountTrainer(trainerMount)
    return
  }

  const mount = document.querySelector<HTMLElement>('[data-hm-react-mount]')

  if (!mount || mount.dataset.mounted === 'true') return

  const locale = getDocumentLocale()
  mount.dataset.mounted = 'true'
  createRoot(mount).render(
    <StrictMode>
      <ReactSmoke locale={locale} />
    </StrictMode>,
  )
}

document.addEventListener('turbo:load', mountReactIsland)

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountReactIsland, { once: true })
} else {
  mountReactIsland()
}
