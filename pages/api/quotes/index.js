import path from 'path'
import { promises as fs } from 'fs'
import { runApiPipeline } from '../../../lib/security/pipeline'

export default async function handler(req,res){
  const guard = runApiPipeline(req, res, { requireAuth: true })
  if (guard.handled) return

  const jsonPath = path.join(process.cwd(), 'data', 'quotes.json')
  const content = await fs.readFile(jsonPath,'utf8')
  const data = JSON.parse(content)
  res.status(200).json(data)
}
