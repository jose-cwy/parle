/**
 * Windows-safe removal of Next.js cache (OneDrive readlink EINVAL workaround).
 * Run automatically via npm "predev" before every `npm run dev`.
 */
const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const root = path.join(__dirname, '..')

const targets = [
  path.join(root, '.next'),
  path.join(root, '.cache', 'next'),
  path.join(root, 'node_modules', '.cache', 'next'),
]

function removeDir(dir) {
  if (!fs.existsSync(dir)) return

  try {
    fs.rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 400 })
  } catch {
    // Fallback for OneDrive placeholder / readlink issues on Windows
    if (process.platform === 'win32') {
      try {
        execSync(`cmd /c rd /s /q "${dir}"`, { stdio: 'ignore', timeout: 60000 })
      } catch {
        try {
          execSync(
            `powershell -NoProfile -Command "Remove-Item -LiteralPath '${dir.replace(/'/g, "''")}' -Recurse -Force -ErrorAction SilentlyContinue"`,
            { stdio: 'ignore', timeout: 60000 }
          )
        } catch {
          console.warn(`[clean-next] Could not fully remove: ${dir}`)
        }
      }
    }
  }
}

for (const dir of targets) {
  removeDir(dir)
}

console.log('[clean-next] Cache cleared.')
