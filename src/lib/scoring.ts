export interface MatchRules {
  bestOf: number;
  pointsToWin: number;
  finalSetPoints: number;
  winBy: number;
}

export interface SetScore {
  setNumber: number;
  homeScore: number;
  awayScore: number;
}

export interface SetResult extends SetScore {
  targetPoints: number;
  complete: boolean;
  winner?: "home" | "away";
}

export interface MatchState {
  sets: SetResult[];
  currentSetNumber: number;
  homeSetsWon: number;
  awaySetsWon: number;
  matchComplete: boolean;
  winner?: "home" | "away";
  setsToWin: number;
}

export function getSetTarget(rules: MatchRules, setNumber: number): number {
  const finalSetNumber = rules.bestOf;
  return setNumber === finalSetNumber ? rules.finalSetPoints : rules.pointsToWin;
}

export function isSetComplete(
  homeScore: number,
  awayScore: number,
  targetPoints: number,
  winBy: number
): boolean {
  if (homeScore < targetPoints && awayScore < targetPoints) {
    return false;
  }
  return Math.abs(homeScore - awayScore) >= winBy;
}

export function getSetWinner(
  homeScore: number,
  awayScore: number,
  complete: boolean
): "home" | "away" | undefined {
  if (!complete) return undefined;
  return homeScore > awayScore ? "home" : "away";
}

export function computeMatchState(
  scores: SetScore[],
  rules: MatchRules
): MatchState {
  const ordered = [...scores].sort((a, b) => a.setNumber - b.setNumber);
  const setsToWin = Math.ceil(rules.bestOf / 2);

  let homeSetsWon = 0;
  let awaySetsWon = 0;

  const sets: SetResult[] = ordered.map((set) => {
    const targetPoints = getSetTarget(rules, set.setNumber);
    const complete = isSetComplete(
      set.homeScore,
      set.awayScore,
      targetPoints,
      rules.winBy
    );
    const winner = getSetWinner(set.homeScore, set.awayScore, complete);
    if (winner === "home") homeSetsWon += 1;
    if (winner === "away") awaySetsWon += 1;

    return {
      ...set,
      targetPoints,
      complete,
      winner
    };
  });

  const matchComplete =
    homeSetsWon >= setsToWin || awaySetsWon >= setsToWin;
  const winner =
    homeSetsWon >= setsToWin ? "home" : awaySetsWon >= setsToWin ? "away" : undefined;

  let currentSetNumber = 1;
  if (sets.length > 0) {
    const last = sets[sets.length - 1];
    if (matchComplete) {
      currentSetNumber = last.setNumber;
    } else if (last.complete) {
      currentSetNumber = Math.min(last.setNumber + 1, rules.bestOf);
    } else {
      currentSetNumber = last.setNumber;
    }
  }

  return {
    sets,
    currentSetNumber,
    homeSetsWon,
    awaySetsWon,
    matchComplete,
    winner,
    setsToWin
  };
}

export function validateRules(rules: MatchRules): string | null {
  if (rules.bestOf < 1 || rules.bestOf > 7) {
    return "Best of must be between 1 and 7";
  }
  if (rules.pointsToWin < 1 || rules.finalSetPoints < 1) {
    return "Points to win must be at least 1";
  }
  if (rules.winBy < 1) {
    return "Win by must be at least 1";
  }
  if (rules.finalSetPoints > rules.pointsToWin + 10) {
    return "Final set points seem too high";
  }
  return null;
}
