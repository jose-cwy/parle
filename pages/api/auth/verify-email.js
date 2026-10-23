import { handleVerifyEmail } from '../../../lib/handlers/authVerifyEmail'

export default async function handler(req, res) {
  return handleVerifyEmail(req, res)
}
