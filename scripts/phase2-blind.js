#!/usr/bin/env node
/**
 * Builds unlabeled A/B pairs for human review.
 *   node scripts/phase2-blind.js --a=docs/eval/baseline.json --b=docs/eval/updated.json
 */
const fs = require('fs')
const path = require('path')
const { SCENARIOS } = require('../lib/parle/eval/scenarios')

function parseArgs(argv) {
  const args = {
    a: 'docs/eval/baseline.json',
    b: 'docs/eval/updated.json',
    out: 'docs/eval/blind-review.md',
  }
  for (const raw of argv.slice(2)) {
    if (raw.startsWith('--a=')) args.a = raw.slice(4)
    else if (raw.startsWith('--b=')) args.b = raw.slice(4)
    else if (raw.startsWith('--out=')) args.out = raw.slice(6)
  }
  return args
}

function load(p) {
  return JSON.parse(fs.readFileSync(path.resolve(p), 'utf8'))
}

function main() {
  const args = parseArgs(process.argv)
  const a = load(args.a)
  const b = load(args.b)
  const byA = Object.fromEntries((a.rows || []).map((r) => [r.id, r]))
  const byB = Object.fromEntries((b.rows || []).map((r) => [r.id, r]))
  const ids = (a.rows || []).map((r) => r.id).filter((id) => byB[id])
  const key = []
  const lines = [
    '# Phase 2 blind review pack',
    '',
    'For each scenario, pick which reply is more natural, emotionally understanding, and useful. Do not look at the key until after scoring.',
    '',
    `A file: \`${args.a}\`  B file: \`${args.b}\``,
    '',
  ]
  ids.forEach((id, i) => {
    const flip = i % 2 === 1
    const left = flip ? byB[id] : byA[id]
    const right = flip ? byA[id] : byB[id]
    key.push({
      id,
      left: flip ? 'updated' : 'baseline',
      right: flip ? 'baseline' : 'updated',
    })
    lines.push(`## ${i + 1}. ${id} (${left.modeId || ''})`)
    lines.push('')
    lines.push('**User**')
    lines.push('')
    const scenario = SCENARIOS.find((s) => s.id === id)
    lines.push(
      '> ' +
        String(left.userText || byA[id].userText || scenario?.userText || '').replace(/\n/g, ' '),
    )
    lines.push('')
    lines.push('**Reply L**')
    lines.push('')
    lines.push(String(left.reply || '').trim() || '(empty)')
    lines.push('')
    lines.push('**Reply R**')
    lines.push('')
    lines.push(String(right.reply || '').trim() || '(empty)')
    lines.push('')
    lines.push('Winner: L / R / tie')
    lines.push('')
  })
  fs.writeFileSync(path.resolve(args.out), lines.join('\n'))
  const keyPath = args.out.replace(/\.md$/, '-key.json')
  fs.writeFileSync(path.resolve(keyPath), JSON.stringify({ key, a: args.a, b: args.b }, null, 2))
  console.log(JSON.stringify({ wrote: args.out, key: keyPath, n: ids.length }))
}

main()
