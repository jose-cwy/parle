import { handleGoogleCallback } from '../../../../lib/handlers/authGoogle'

export default async function handler(req, res) {
  return handleGoogleCallback(req, res)
}
