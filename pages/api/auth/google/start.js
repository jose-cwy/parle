import { handleGoogleStart } from '../../../../lib/handlers/authGoogle'

export default async function handler(req, res) {
  return handleGoogleStart(req, res)
}
