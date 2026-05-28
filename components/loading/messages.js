export const LOADING_MESSAGES = [
  'Preparing your quiet space…',
  'Opening your private space…',
  'Gathering your thoughts…',
  'Almost ready…',
]

export function pickLoadingMessage(seed) {
  const index =
    typeof seed === 'number'
      ? Math.abs(seed) % LOADING_MESSAGES.length
      : Math.floor(Math.random() * LOADING_MESSAGES.length)
  return LOADING_MESSAGES[index]
}
