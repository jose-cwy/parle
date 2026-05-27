/**
 * Free ports 3000/3001 when a stale Next dev server is still running (Windows).
 * Usage: npm run dev:reset
 */
const { execSync } = require('child_process')

const ports = [3000, 3001]

if (process.platform !== 'win32') {
  console.log('[free-port] Skipped (Windows-only helper).')
  process.exit(0)
}

for (const port of ports) {
  try {
    const out = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf8' })
    const pids = new Set()
    for (const line of out.split('\n')) {
      if (!line.includes('LISTENING')) continue
      const parts = line.trim().split(/\s+/)
      const pid = parts[parts.length - 1]
      if (pid && /^\d+$/.test(pid)) pids.add(pid)
    }
    for (const pid of pids) {
      try {
        execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' })
        console.log(`[free-port] Stopped PID ${pid} on port ${port}`)
      } catch {
        /* already gone */
      }
    }
  } catch {
    /* port not in use */
  }
}
