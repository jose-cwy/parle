import { setTermsAcceptanceCookie } from '../../../lib/auth'

export default function handler(req,res){
  if(req.method !== 'POST') return res.status(405).end()

  // The cookie is our server-side proof that the user completed the T&C flow.
  setTermsAcceptanceCookie(res)
  return res.status(200).json({ ok: true })
}
