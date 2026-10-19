import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'

const root = new URL('../app/frontend/holdem/', import.meta.url)
const deterministicRoots = ['domain', 'application', 'strategy'].map((directory) => new URL(`${directory}/`, root))
const forbidden = [
  { label: 'React import', pattern: /from\s+['"](?:react|react-dom|@hotwired\/)/ },
  { label: 'DOM/storage/network API', pattern: /\b(?:document|localStorage|sessionStorage|indexedDB|fetch|XMLHttpRequest|navigator)\b/ },
  { label: 'non-deterministic randomness', pattern: /Math\.random\s*\(/ },
  { label: 'implicit system clock', pattern: /\bnew\s+Date\s*\(/ }
]

async function filesUnder(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const path = join(directory.pathname, entry.name)
    if (entry.isDirectory()) files.push(...await filesUnder(new URL(`file://${path}/`)))
    else if (entry.name.endsWith('.ts')) files.push(path)
  }
  return files
}

const violations = []
const deterministicFiles = (await Promise.all(deterministicRoots.map((directory) => filesUnder(directory)))).flat()
for (const file of deterministicFiles) {
  const source = await readFile(file, 'utf8')
  source.split('\n').forEach((line, index) => {
    for (const rule of forbidden) {
      if (rule.pattern.test(line)) {
        violations.push(`${file}:${index + 1}: ${rule.label}`)
      }
    }
  })
}

if (violations.length > 0) {
  console.error(violations.join('\n'))
  process.exitCode = 1
} else {
  console.log(`Frontend boundary validation passed for ${deterministicFiles.length} deterministic TypeScript files.`)
}
