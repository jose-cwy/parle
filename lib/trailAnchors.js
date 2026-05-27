/** Trail handoff from moon story — sync with MoonStoryScene TRAIL_HANDOFF */
export const TRAIL_HANDOFF = [0.50, 0.28]

export const DEFAULT_FEATURE_ANCHORS = [
  [0.32, 0.14],  // chat — left
  [0.68, 0.36],  // letter — right
  [0.32, 0.52],  // diary — left
  [0.68, 0.72],  // quotes — right
]

export const FEATURE_TRAIL_NODE = [1, 3, 5, 6]

/** Outer edge of panel toward center, vertical midpoint */
export function panelAnchorFromRect(rect, side, W, H) {
  const y = (rect.top + rect.height * 0.5) / H
  const x = side === 'left' ? rect.right / W : rect.left / W
  return [
    Math.min(0.92, Math.max(0.08, x)),
    Math.min(0.92, Math.max(0.08, y)),
  ]
}

function midpoint(a, b) {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
}

/** Build full trail path from measured feature anchors */
export function buildTrailNodes(featureAnchors) {
  const a = featureAnchors?.length >= 4 ? featureAnchors : DEFAULT_FEATURE_ANCHORS
  return [
    TRAIL_HANDOFF,
    a[0],
    midpoint(a[0], a[1]),
    a[1],
    midpoint(a[1], a[2]),
    a[2],
    a[3],
    [0.50, 0.05],
  ]
}

export function getTrailMilestones(nodeCount) {
  return new Set(FEATURE_TRAIL_NODE.filter(i => i < nodeCount))
}

/** Targets for ConstellationScene scripted shooting stars */
export const scriptedStarTargets = {
  moon: [0.50, 0.18],
  handoff: TRAIL_HANDOFF,
  chat: DEFAULT_FEATURE_ANCHORS[0],
}

export function updateScriptedStarTargets(featureAnchors) {
  if (featureAnchors?.[0]) scriptedStarTargets.chat = featureAnchors[0]
}
