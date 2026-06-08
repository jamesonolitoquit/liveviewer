import { execSync } from 'child_process'
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, readdirSync, statSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

function copyRecursive(src, dest) {
  mkdirSync(dest, { recursive: true })
  const entries = readdirSync(src, { withFileTypes: true })
  for (const entry of entries) {
    const srcPath = join(src, entry.name)
    const destPath = join(dest, entry.name)
    if (entry.isDirectory()) {
      copyRecursive(srcPath, destPath)
    } else {
      copyFileSync(srcPath, destPath)
    }
  }
}

function build(target) {
  console.log(`\n=== Building for ${target} ===`)

  execSync(`npx vite build`, { cwd: root, stdio: 'inherit' })

  const distDir = join(root, 'dist')
  const outDir = join(root, `dist-${target}`)
  const outDist = join(outDir, 'dist')

  if (existsSync(outDir)) {
    execSync(`rm -rf "${outDir}"`, { shell: true })
  }
  mkdirSync(outDist, { recursive: true })

  // Copy built files
  copyRecursive(distDir, outDist)

  // Copy icons alongside dist (for Firefox which may not inline them)
  const iconSrc = join(root, 'src', 'icons')
  if (existsSync(iconSrc)) {
    const iconDest = join(outDir, 'icons')
    copyRecursive(iconSrc, iconDest)
  }

  // Set version from root package
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf-8'))
  const manifestPath = join(outDist, 'manifest.json')
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'))
  manifest.version = pkg.version

  if (target === 'firefox') {
    manifest.browser_specific_settings = {
      gecko: { id: 'liveviewer@jaoce.com', strict_min_version: '109.0' }
    }
  }

  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2))

  // Create ZIP
  const zipName = `liveviewer-${target}-v${pkg.version}.zip`
  execSync(`npx bestzip "${join(outDir, zipName)}" .`, { cwd: outDir, stdio: 'inherit' })
  console.log(`  -> ${join(outDir, zipName)}`)
}

console.log('Liveviewer Extension Packager')
build('chrome')
build('firefox')
console.log('\nDone!')
