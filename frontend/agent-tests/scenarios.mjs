// Agent scenarios: an objective, the checkpoint it starts from, and a grader that reads the final save.
// Listed in the order a player meets them; .github/workflows/agent-gameplay.yml runs them one after
// another in this order, selecting each with `--grep "[<id>]"`.

const shelters = (town) => town?.buildings?.filter((b) => b.type === 'shelter').length ?? 0
const anchors = (town) => town?.buildings?.filter((b) => b.type === 'bridgeAnchor').length ?? 0

// Grove stock used to be the number deposits.wood. It is now deposits.grove.stock.
export function groveStock(town) {
  const node = town?.deposits?.grove
  if (node && typeof node === 'object' && Number.isFinite(Number(node.stock))) return Number(node.stock)
  const legacy = town?.deposits?.wood
  return Number.isFinite(Number(legacy)) ? Number(legacy) : undefined
}

export function gradeGatherWood(start, end) {
  const before = groveStock(start)
  const after = groveStock(end)
  const gathered = end?.lastInteraction?.siteId === 'grove'
  const progressed = end?.resources?.wood > start?.resources?.wood && end?.xp > start?.xp
  // A normal gather lowers the stock. A gather after the cooldown first refills the
  // empty node, then takes one yield, so the saved stock rises and the timer clears.
  const consumed = Number.isFinite(before) && Number.isFinite(after) && (
    after < before ||
    (before <= 0 && after > 0 && end?.deposits?.grove?.regrowAt === 0 && start?.deposits?.grove?.regrowAt)
  )
  return Boolean(end && gathered && progressed && consumed)
}

export function gradeFirstSteps(start, end) {
  return Boolean(
    end && !start.completed.includes('firstSteps') &&
    end.completed?.includes('firstSteps') &&
    shelters(end) > shelters(start) &&
    end.xp > start.xp,
  )
}

export function gradeHoldFast(start, end) {
  return Boolean(
    end && !start.completed.includes('anchor') &&
    end.completed?.includes('anchor') &&
    anchors(end) > anchors(start) &&
    end.xp > start.xp,
  )
}

export const scenarios = [
  {
    id: 'gather-wood',
    checkpoint: 'new-town',
    objective: 'Gather wood at New Haven.',
    maxSteps: 8,
    grade: gradeGatherWood,
    expectation: 'wood, grove deposit, XP, and gathering action should change through play',
    outcome: (start, end) => ({ startingWood: start.resources.wood, finalWood: end?.resources?.wood, startingGrove: groveStock(start), finalGrove: groveStock(end), startingXp: start.xp, finalXp: end?.xp }),
  },
  {
    id: 'first-steps',
    checkpoint: 'new-town',
    // Deliberately names the quest, not the building: the agent has to find out what First Steps asks for.
    objective: 'Complete the First Steps quest.',
    maxSteps: 10,
    grade: gradeFirstSteps,
    expectation: 'a shelter should be built through play and First Steps should be completed',
    outcome: (start, end) => ({ startingShelters: shelters(start), finalShelters: shelters(end), completed: end?.completed, startingXp: start.xp, finalXp: end?.xp }),
  },
  {
    id: 'hold-fast',
    checkpoint: 'shelter-built',
    // Names the quest, not the building: the agent must connect "Hold Fast" to the workshop's bridge upgrade.
    objective: 'Complete the Hold Fast quest.',
    maxSteps: 8,
    grade: gradeHoldFast,
    expectation: 'the bridge-anchor upgrade should be built through play and Hold Fast should be completed',
    outcome: (start, end) => ({ startingAnchors: anchors(start), finalAnchors: anchors(end), completed: end?.completed, startingXp: start.xp, finalXp: end?.xp }),
  },
]
