import { handleVerifyStatus } from '../../../../lib/handlers/authVerifyEmail'

export default async function handler(req, res) {
  return handleVerifyStatus(req, res)
}
