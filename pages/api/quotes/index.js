import path from 'path'
import { promises as fs } from 'fs'
import { getTokenFromReq, verifyToken } from '../../../lib/auth'

export default async function handler(req,res){
  const token = getTokenFromReq(req)
  const payload = verifyToken(token)
  if(!payload) return res.status(401).json({error:'Unauthorized'})

  const jsonPath = path.join(process.cwd(), 'data', 'quotes.json')
  const content = await fs.readFile(jsonPath,'utf8')
  const data = JSON.parse(content)
  res.status(200).json(data)
}
