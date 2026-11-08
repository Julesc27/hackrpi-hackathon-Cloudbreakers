// Agent scenarios: an objective, the checkpoint it starts from, and a grader that reads the final save.
// Each scenario has its own workflow that selects it with `--grep "[<id>]"`.

const shelters = (town) => town?.buildings?.filter((b) => b.type === 'shelter').length ?? 0

export function gradeGatherWood(start, end) {
  return Boolean(
    end && end.resources?.wood > start.resources.wood &&
    end.deposits?.wood < start.deposits.wood &&
    end.xp > start.xp &&
    end.lastInteraction?.siteId === 'grove',
  )
}

export function gradeFirstSteps(start, end) {
  return Boolean(
    end && !start.completed.includes('firstSteps') &&
    end.completed?.includes('firstSteps') &&
    shelters(end) > shelters(start) &&
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
    outcome: (start, end) => ({ startingWood: start.resources.wood, finalWood: end?.resources?.wood, startingXp: start.xp, finalXp: end?.xp }),
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
]
