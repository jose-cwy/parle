import { handleResendVerification } from '../../../../lib/handlers/authVerifyEmail'

export default async function handler(req, res) {
  return handleResendVerification(req, res)
}
