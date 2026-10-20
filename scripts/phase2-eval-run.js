#!/usr/bin/env node
/**
 * Phase 2 eval: synthetic scenarios against current prompt stack.
 * Usage:
 *   node scripts/phase2-eval-run.js --label=baseline --think=on
 *   node scripts/phase2-eval-run.js --label=baseline-think-off --think=off --subset=think
 */
const fs = require('fs')
const path = require('path')
const { loadEnvLocal } = require('../tests/helpers/loadEnvLocal')
const { SCENARIOS, THINK_COMPARE_IDS } = require('../lib/parle/eval/scenarios')
const { scoreReply, summarize } = require('../lib/parle/eval/score')
const { getReplyQualitySignals, buildReplyQualityBlock } = require('../lib/parle/replyQuality')
const { runHiddenThink } = require('../lib/parle/hiddenThink')
const { buildChatCompletionMessages } = require('../lib/parle/chatComplete')
const { openaiChatComplete } = require('../lib/openai')

function parseArgs(argv) {
  const args = { label: 'run', think: 'off', subset: 'all', ids: '' }
  for (const raw of argv.slice(2)) {
    if (raw.startsWith('--label=')) args.label = raw.slice('--label='.length)
    else if (raw.startsWith('--think=')) args.think = raw.slice('--think='.length)
    else if (raw.startsWith('--subset=')) args.subset = raw.slice('--subset='.length)
    else if (raw.startsWith('--ids=')) args.ids = raw.slice('--ids='.length)
  }
  return args
}

async function runOne(scenario, thinkMode) {
  process.env.PARLE_HIDDEN_THINK = thinkMode === 'on' ? 'on' : 'off'
  const quality = getReplyQualitySignals({
    userText: scenario.userText,
    history: scenario.history || [],
    modeId: scenario.modeId,
  })
  const hiddenInjections = [buildReplyQualityBlock(quality)]
  let thinkMs = 0
  if (thinkMode === 'on') {
    const t0 = Date.now()
    const thinkBlock = await runHiddenThink({
      userText: scenario.userText,
      history: scenario.history || [],
      modeId: scenario.modeId,
      quality,
    })
    thinkMs = Date.now() - t0
    if (thinkBlock) hiddenInjections.push(thinkBlock)
  }

  const messages = buildChatCompletionMessages({
    modeId: scenario.modeId,
    hiddenInjections,
    conversationHistory: scenario.history || [],
    userText: scenario.userText,
  })

  const r0 = Date.now()
  const meta = await openaiChatComplete({
    messages,
    temperature: 0.65,
    returnMeta: true,
  })
  const replyMs = Date.now() - r0
  const reply = meta.content
  return {
    id: scenario.id,
    modeId: scenario.modeId,
    userText: scenario.userText,
    think: thinkMode,
    thinkMs: thinkMode === 'on' ? thinkMs : 0,
    replyMs,
    totalMs: (thinkMode === 'on' ? thinkMs : 0) + replyMs,
    usage: meta.usage,
    model: meta.model,
    reply,
    heuristic: scoreReply(scenario, reply),
  }
}

async function main() {
  loadEnvLocal()
  if (!process.env.OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY is required')
    process.exit(1)
  }
  const args = parseArgs(process.argv)
  const idSet = args.ids
    ? new Set(args.ids.split(',').map((s) => s.trim()).filter(Boolean))
    : null
  const list = idSet
    ? SCENARIOS.filter((s) => idSet.has(s.id))
    : args.subset === 'think'
      ? SCENARIOS.filter((s) => THINK_COMPARE_IDS.includes(s.id))
      : SCENARIOS

  const rows = []
  for (const scenario of list) {
    process.stdout.write(`${scenario.id}... `)
    try {
      const row = await runOne(scenario, args.think)
      rows.push(row)
      console.log(`score=${row.heuristic.score} think=${row.thinkMs}ms reply=${row.replyMs}ms`)
    } catch (error) {
      console.log('FAIL', error.message || error)
      rows.push({
        id: scenario.id,
        modeId: scenario.modeId,
        think: args.think,
        error: String(error.message || error).slice(0, 240),
        heuristic: { score: 0, deductions: ['api_error'] },
      })
    }
  }

  const outDir = path.join(__dirname, '..', 'docs', 'eval')
  fs.mkdirSync(outDir, { recursive: true })
  const payload = {
    label: args.label,
    think: args.think,
    generatedAt: new Date().toISOString(),
    summary: summarize(rows),
    rows,
  }
  const outPath = path.join(outDir, `${args.label}.json`)
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2))
  console.log(JSON.stringify({ wrote: outPath, ...payload.summary }, null, 2))
}

main().catch((error) => {
  console.error(error.message || error)
  process.exit(1)
})
