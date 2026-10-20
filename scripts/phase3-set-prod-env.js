#!/usr/bin/env node
const fs = require('fs')
const os = require('os')
const path = require('path')
const { spawnSync } = require('child_process')
const { Client } = require('pg')
const { loadEnvLocal } = require('./rehearsalEnv')

loadEnvLocal()

function vercel(args, input) {
  const result = spawnSync('npx', ['--yes', 'vercel', ...args], {
    encoding: 'utf8',
    timeout: 90000,
    shell: true,
    input: input || undefined,
  })
  return result
}

async function founderEmail() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: true },
  })
  await client.connect()
  try {
    const result = await client.query(`
      SELECT email FROM users
      WHERE email NOT ILIKE '%@parle.test'
      ORDER BY created_at ASC NULLS LAST
      LIMIT 1
    `)
    return result.rows[0]?.email || ''
  } finally {
    await client.end()
  }
}

function addEnv(name, value, environment) {
  const listed = spawnSync(
    'npx',
    ['--yes', 'vercel', 'env', 'ls', '--environment', environment, '--scope', 'josz', '--project', 'parle'],
    { encoding: 'utf8', timeout: 90000, shell: true },
  )
  const exists = new RegExp(`^\\s*${name}\\s`, 'm').test(listed.stdout || '')
  if (exists) {
    spawnSync(
      'npx',
      ['--yes', 'vercel', 'env', 'rm', name, environment, '--scope', 'josz', '--project', 'parle', '--yes'],
      { encoding: 'utf8', timeout: 90000, shell: true },
    )
  }
  const added = vercel(
    ['env', 'add', name, environment, '--scope', 'josz', '--project', 'parle', '--sensitive'],
    `${value}\n`,
  )
  if (added.status !== 0) {
    const retry = vercel(
      ['env', 'add', name, environment, '--scope', 'josz', '--project', 'parle'],
      `${value}\n`,
    )
    if (retry.status !== 0) {
      throw new Error(`${name} add failed: ${(retry.stderr || added.stderr || '').slice(0, 400)}`)
    }
  }
}

async function main() {
  const tmp = path.join(os.tmpdir(), 'parle-admin-emails.txt')
  let email = ''
  if (fs.existsSync(tmp)) {
    email = String(fs.readFileSync(tmp, 'utf8')).split(',')[0].trim()
  }
  if (!email) email = await founderEmail()
  if (!email || email.toLowerCase().endsWith('@parle.test')) {
    throw new Error('could not resolve a founder email')
  }
  addEnv('ADMIN_EMAILS', email, 'production')
  addEnv('PARLE_ANALYTICS_VERIFIED_FROM', '2026-10-20', 'production')
  const list = spawnSync(
    'npx',
    ['--yes', 'vercel', 'env', 'ls', '--environment', 'production', '--scope', 'josz', '--project', 'parle'],
    { encoding: 'utf8', timeout: 90000, shell: true },
  )
  const names = (list.stdout || '')
    .split('\n')
    .map((line) => line.trim().split(/\s+/)[0])
    .filter(Boolean)
  console.log(
    JSON.stringify({
      adminSet: names.includes('ADMIN_EMAILS'),
      verifiedFromSet: names.includes('PARLE_ANALYTICS_VERIFIED_FROM'),
      hiddenThinkPresent: names.includes('PARLE_HIDDEN_THINK'),
      adminEmailDomain: email.split('@')[1] || '',
    }),
  )
}

main().catch((error) => {
  console.error(error.message || error)
  process.exit(1)
})
