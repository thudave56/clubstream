import {
  getSetTarget,
  isSetComplete,
  getSetWinner,
  computeMatchState,
  validateRules,
  type MatchRules,
  type SetScore
} from "./scoring";

const DEFAULT_RULES: MatchRules = {
  bestOf: 3,
  pointsToWin: 25,
  finalSetPoints: 15,
  winBy: 2
};

describe("scoring", () => {
  describe("getSetTarget", () => {
    it("should return pointsToWin for non-final sets", () => {
      expect(getSetTarget(DEFAULT_RULES, 1)).toBe(25);
      expect(getSetTarget(DEFAULT_RULES, 2)).toBe(25);
    });

    it("should return finalSetPoints for the final set", () => {
      expect(getSetTarget(DEFAULT_RULES, 3)).toBe(15);
    });

    it("should handle best-of-5 correctly", () => {
      const bo5: MatchRules = { ...DEFAULT_RULES, bestOf: 5 };
      expect(getSetTarget(bo5, 1)).toBe(25);
      expect(getSetTarget(bo5, 4)).toBe(25);
      expect(getSetTarget(bo5, 5)).toBe(15);
    });

    it("should handle best-of-1", () => {
      const bo1: MatchRules = { ...DEFAULT_RULES, bestOf: 1 };
      expect(getSetTarget(bo1, 1)).toBe(15);
    });
  });

  describe("isSetComplete", () => {
    it("should return false when neither team reaches target", () => {
      expect(isSetComplete(10, 12, 25, 2)).toBe(false);
    });

    it("should return true when one team reaches target with required margin", () => {
      expect(isSetComplete(25, 20, 25, 2)).toBe(true);
      expect(isSetComplete(18, 25, 25, 2)).toBe(true);
    });

    it("should return false when target reached but margin insufficient", () => {
      expect(isSetComplete(25, 24, 25, 2)).toBe(false);
      expect(isSetComplete(24, 25, 25, 2)).toBe(false);
    });

    it("should handle deuce/extended play correctly", () => {
      expect(isSetComplete(26, 24, 25, 2)).toBe(true);
      expect(isSetComplete(27, 25, 25, 2)).toBe(true);
      expect(isSetComplete(25, 27, 25, 2)).toBe(true);
      expect(isSetComplete(30, 28, 25, 2)).toBe(true);
    });

    it("should handle deuce still in progress", () => {
      expect(isSetComplete(26, 25, 25, 2)).toBe(false);
      expect(isSetComplete(25, 26, 25, 2)).toBe(false);
      expect(isSetComplete(30, 29, 25, 2)).toBe(false);
    });

    it("should handle win-by-1 rules", () => {
      expect(isSetComplete(25, 24, 25, 1)).toBe(true);
      expect(isSetComplete(24, 25, 25, 1)).toBe(true);
    });

    it("should handle 0-0 score", () => {
      expect(isSetComplete(0, 0, 25, 2)).toBe(false);
    });

    it("should handle final set target (15 points)", () => {
      expect(isSetComplete(15, 10, 15, 2)).toBe(true);
      expect(isSetComplete(15, 14, 15, 2)).toBe(false);
      expect(isSetComplete(16, 14, 15, 2)).toBe(true);
    });
  });

  describe("getSetWinner", () => {
    it("should return undefined when set is not complete", () => {
      expect(getSetWinner(10, 8, false)).toBeUndefined();
    });

    it("should return 'home' when home has higher score", () => {
      expect(getSetWinner(25, 20, true)).toBe("home");
    });

    it("should return 'away' when away has higher score", () => {
      expect(getSetWinner(20, 25, true)).toBe("away");
    });
  });

  describe("computeMatchState", () => {
    it("should handle empty scores (no sets played)", () => {
      const state = computeMatchState([], DEFAULT_RULES);

      expect(state.sets).toHaveLength(0);
      expect(state.currentSetNumber).toBe(1);
      expect(state.homeSetsWon).toBe(0);
      expect(state.awaySetsWon).toBe(0);
      expect(state.matchComplete).toBe(false);
      expect(state.winner).toBeUndefined();
      expect(state.setsToWin).toBe(2);
    });

    it("should track an in-progress first set", () => {
      const scores: SetScore[] = [
        { setNumber: 1, homeScore: 12, awayScore: 10 }
      ];
      const state = computeMatchState(scores, DEFAULT_RULES);

      expect(state.sets).toHaveLength(1);
      expect(state.sets[0].complete).toBe(false);
      expect(state.currentSetNumber).toBe(1);
      expect(state.matchComplete).toBe(false);
    });

    it("should detect a completed first set and advance", () => {
      const scores: SetScore[] = [
        { setNumber: 1, homeScore: 25, awayScore: 20 }
      ];
      const state = computeMatchState(scores, DEFAULT_RULES);

      expect(state.sets[0].complete).toBe(true);
      expect(state.sets[0].winner).toBe("home");
      expect(state.homeSetsWon).toBe(1);
      expect(state.currentSetNumber).toBe(2);
      expect(state.matchComplete).toBe(false);
    });

    it("should detect match won 2-0 (straight sets)", () => {
      const scores: SetScore[] = [
        { setNumber: 1, homeScore: 25, awayScore: 20 },
        { setNumber: 2, homeScore: 25, awayScore: 18 }
      ];
      const state = computeMatchState(scores, DEFAULT_RULES);

      expect(state.homeSetsWon).toBe(2);
      expect(state.awaySetsWon).toBe(0);
      expect(state.matchComplete).toBe(true);
      expect(state.winner).toBe("home");
      expect(state.currentSetNumber).toBe(2);
    });

    it("should detect match won 2-1 (three sets)", () => {
      const scores: SetScore[] = [
        { setNumber: 1, homeScore: 25, awayScore: 20 },
        { setNumber: 2, homeScore: 20, awayScore: 25 },
        { setNumber: 3, homeScore: 15, awayScore: 10 }
      ];
      const state = computeMatchState(scores, DEFAULT_RULES);

      expect(state.homeSetsWon).toBe(2);
      expect(state.awaySetsWon).toBe(1);
      expect(state.matchComplete).toBe(true);
      expect(state.winner).toBe("home");
    });

    it("should detect away team winning", () => {
      const scores: SetScore[] = [
        { setNumber: 1, homeScore: 20, awayScore: 25 },
        { setNumber: 2, homeScore: 18, awayScore: 25 }
      ];
      const state = computeMatchState(scores, DEFAULT_RULES);

      expect(state.awaySetsWon).toBe(2);
      expect(state.matchComplete).toBe(true);
      expect(state.winner).toBe("away");
    });

    it("should use final set points for last possible set", () => {
      const scores: SetScore[] = [
        { setNumber: 1, homeScore: 25, awayScore: 20 },
        { setNumber: 2, homeScore: 20, awayScore: 25 },
        { setNumber: 3, homeScore: 8, awayScore: 7 }
      ];
      const state = computeMatchState(scores, DEFAULT_RULES);

      expect(state.sets[2].targetPoints).toBe(15);
      expect(state.sets[2].complete).toBe(false);
      expect(state.matchComplete).toBe(false);
    });

    it("should handle deuce in regular set", () => {
      const scores: SetScore[] = [
        { setNumber: 1, homeScore: 26, awayScore: 25 }
      ];
      const state = computeMatchState(scores, DEFAULT_RULES);

      expect(state.sets[0].complete).toBe(false);
      expect(state.currentSetNumber).toBe(1);
    });

    it("should complete deuce when margin reached", () => {
      const scores: SetScore[] = [
        { setNumber: 1, homeScore: 27, awayScore: 25 }
      ];
      const state = computeMatchState(scores, DEFAULT_RULES);

      expect(state.sets[0].complete).toBe(true);
      expect(state.sets[0].winner).toBe("home");
    });

    it("should sort sets by setNumber regardless of input order", () => {
      const scores: SetScore[] = [
        { setNumber: 2, homeScore: 20, awayScore: 25 },
        { setNumber: 1, homeScore: 25, awayScore: 20 }
      ];
      const state = computeMatchState(scores, DEFAULT_RULES);

      expect(state.sets[0].setNumber).toBe(1);
      expect(state.sets[1].setNumber).toBe(2);
    });

    it("should calculate setsToWin for best-of-5", () => {
      const bo5: MatchRules = { ...DEFAULT_RULES, bestOf: 5 };
      const state = computeMatchState([], bo5);

      expect(state.setsToWin).toBe(3);
    });

    it("should not exceed bestOf for currentSetNumber", () => {
      const scores: SetScore[] = [
        { setNumber: 1, homeScore: 25, awayScore: 20 },
        { setNumber: 2, homeScore: 20, awayScore: 25 },
        { setNumber: 3, homeScore: 14, awayScore: 14 }
      ];
      const state = computeMatchState(scores, DEFAULT_RULES);

      expect(state.currentSetNumber).toBe(3);
      expect(state.currentSetNumber).toBeLessThanOrEqual(DEFAULT_RULES.bestOf);
    });
  });

  describe("validateRules", () => {
    it("should return null for valid default rules", () => {
      expect(validateRules(DEFAULT_RULES)).toBeNull();
    });

    it("should reject bestOf below 1", () => {
      expect(validateRules({ ...DEFAULT_RULES, bestOf: 0 })).toBeTruthy();
    });

    it("should reject bestOf above 7", () => {
      expect(validateRules({ ...DEFAULT_RULES, bestOf: 8 })).toBeTruthy();
    });

    it("should reject pointsToWin below 1", () => {
      expect(validateRules({ ...DEFAULT_RULES, pointsToWin: 0 })).toBeTruthy();
    });

    it("should reject finalSetPoints below 1", () => {
      expect(validateRules({ ...DEFAULT_RULES, finalSetPoints: 0 })).toBeTruthy();
    });

    it("should reject winBy below 1", () => {
      expect(validateRules({ ...DEFAULT_RULES, winBy: 0 })).toBeTruthy();
    });

    it("should reject finalSetPoints too far above pointsToWin", () => {
      expect(
        validateRules({ ...DEFAULT_RULES, pointsToWin: 25, finalSetPoints: 36 })
      ).toBeTruthy();
    });

    it("should allow finalSetPoints equal to pointsToWin", () => {
      expect(
        validateRules({ ...DEFAULT_RULES, pointsToWin: 25, finalSetPoints: 25 })
      ).toBeNull();
    });

    it("should allow custom valid rules", () => {
      const custom: MatchRules = {
        bestOf: 5,
        pointsToWin: 21,
        finalSetPoints: 15,
        winBy: 2
      };
      expect(validateRules(custom)).toBeNull();
    });

    it("should allow best-of-1 with matching points", () => {
      const bo1: MatchRules = {
        bestOf: 1,
        pointsToWin: 25,
        finalSetPoints: 25,
        winBy: 2
      };
      expect(validateRules(bo1)).toBeNull();
    });
  });
});
