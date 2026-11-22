export const SCARE_RULES = { firstGrace: 10, cooldown: 15 };

export function createScareDirector(rules = SCARE_RULES) {
  let last = -Infinity, fired = 0;
  return {
    canScare: (runTime) => runTime >= rules.firstGrace && runTime - last >= rules.cooldown,
    record(runTime) { last = runTime; fired += 1; },
    reset() { last = -Infinity; fired = 0; },
    count: () => fired,
  };
}
