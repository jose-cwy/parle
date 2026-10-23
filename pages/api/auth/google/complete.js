import { handleGoogleComplete } from '../../../../lib/handlers/authGoogle'

export default async function handler(req, res) {
  return handleGoogleComplete(req, res)
}
