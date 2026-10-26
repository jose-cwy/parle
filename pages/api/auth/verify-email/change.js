import { handleEmailChangeRequest } from '../../../../lib/handlers/authVerifyEmail'

export default async function handler(req, res) {
  return handleEmailChangeRequest(req, res)
}
