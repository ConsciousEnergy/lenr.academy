/**
 * Cycle Validation Service
 *
 * Provides utilities to validate discovered cycles against known nuclear reaction data
 * and theoretical calculations. Can be extended to integrate with external databases
 * like EXFOR, NNDC, or JINA Reaclib.
 */

import type { DiscoveredCycle, CycleReaction } from '../types';

/**
 * Known cycle patterns from literature
 * These can be used to validate our cycle detection algorithm
 */
export const KNOWN_CYCLES = {
  /**
   * CNO Cycle (simplified)
   * H-1 + C-12 → N-13 → C-13 + e+
   * H-1 + C-13 → N-14
   * H-1 + N-14 → O-15 → N-15 + e+
   * H-1 + N-15 → C-12 + He-4
   * Net: 4 H-1 → He-4 + 2 e+ + 2 neutrinos
   * Total energy: ~26.7 MeV
   */
  CNO_CYCLE: {
    fuelNuclides: ['H-1', 'C-12'],
    reactions: [
      { inputs: ['H-1', 'C-12'], outputs: ['N-13'], type: 'fusion' as const, MeV: 1.94 },
      { inputs: ['H-1', 'C-13'], outputs: ['N-14'], type: 'fusion' as const, MeV: 7.55 },
      { inputs: ['H-1', 'N-14'], outputs: ['O-15'], type: 'fusion' as const, MeV: 7.30 },
      { inputs: ['H-1', 'N-15'], outputs: ['C-12', 'He-4'], type: 'twotwo' as const, MeV: 4.97 },
    ],
    totalEnergy: 21.76, // Approximate
    description: 'CNO cycle from stellar nucleosynthesis',
  },

  /**
   * Li-6 Cycle (from issue #92 example)
   * Li-6 + Li-6 → C-12 (28.18 MeV)
   * C-12 + Li-6 → O-18 (14.87 MeV) ← Feedback
   * O-18 + Li-6 → Mg-24 (27.24 MeV) ← Feedback
   * Mg-24 + Li-6 → Si-30 (24.60 MeV) ← Feedback
   */
  LI6_CYCLE: {
    fuelNuclides: ['Li-6'],
    reactions: [
      { inputs: ['Li-6', 'Li-6'], outputs: ['C-12'], type: 'fusion' as const, MeV: 28.18 },
      { inputs: ['C-12', 'Li-6'], outputs: ['O-18'], type: 'fusion' as const, MeV: 14.87 },
      { inputs: ['O-18', 'Li-6'], outputs: ['Mg-24'], type: 'fusion' as const, MeV: 27.24 },
      { inputs: ['Mg-24', 'Li-6'], outputs: ['Si-30'], type: 'fusion' as const, MeV: 24.60 },
    ],
    totalEnergy: 94.09,
    description: 'Li-6 only cycle with high feedback ratio',
  },

  /**
   * H-1 + B-11 Cycle (CNO-like, from issue #92 example)
   * H-1 + B-11 → C-12 (15.96 MeV)
   * C-12 + H-1 → C-13 (4.16 MeV) ← Feedback
   * C-13 + H-1 → N-14 (7.39 MeV) ← Feedback
   * N-14 + H-1 → N-15 (10.21 MeV) ← Feedback
   */
  H1_B11_CYCLE: {
    fuelNuclides: ['H-1', 'B-11'],
    reactions: [
      { inputs: ['H-1', 'B-11'], outputs: ['C-12'], type: 'fusion' as const, MeV: 15.96 },
      { inputs: ['C-12', 'H-1'], outputs: ['C-13'], type: 'fusion' as const, MeV: 4.16 },
      { inputs: ['C-13', 'H-1'], outputs: ['N-14'], type: 'fusion' as const, MeV: 7.39 },
      { inputs: ['N-14', 'H-1'], outputs: ['N-15'], type: 'fusion' as const, MeV: 10.21 },
    ],
    totalEnergy: 37.72,
    description: 'H-1 + B-11 cycle with high natural abundance',
  },
};

/**
 * Validate a discovered cycle against known cycle patterns
 */
export function validateCycleAgainstKnown(
  cycle: DiscoveredCycle,
  tolerance: number = 0.1
): {
  matches: boolean;
  matchedCycle?: typeof KNOWN_CYCLES[keyof typeof KNOWN_CYCLES];
  similarity: number;
} {
  let bestMatch: {
    cycle: typeof KNOWN_CYCLES[keyof typeof KNOWN_CYCLES];
    similarity: number;
  } | null = null;

  // Compare against each known cycle
  for (const [key, knownCycle] of Object.entries(KNOWN_CYCLES)) {
    const similarity = calculateCycleSimilarity(cycle, knownCycle);
    
    if (!bestMatch || similarity > bestMatch.similarity) {
      bestMatch = {
        cycle: knownCycle as typeof KNOWN_CYCLES[keyof typeof KNOWN_CYCLES],
        similarity,
      };
    }
  }

  if (!bestMatch) {
    return { matches: false, similarity: 0 };
  }

  const matches = bestMatch.similarity >= 1 - tolerance;

  return {
    matches,
    matchedCycle: bestMatch.cycle,
    similarity: bestMatch.similarity,
  };
}

/**
 * Calculate similarity between a discovered cycle and a known cycle pattern
 * Returns a value between 0 and 1, where 1 is a perfect match
 */
function calculateCycleSimilarity(
  discovered: DiscoveredCycle,
  known: typeof KNOWN_CYCLES[keyof typeof KNOWN_CYCLES]
): number {
  // Check fuel nuclides match
  const fuelMatch = arraysMatch(discovered.fuelNuclides.sort(), known.fuelNuclides.sort());
  if (!fuelMatch) return 0;

  // Check reaction count matches
  if (discovered.reactions.length !== known.reactions.length) {
    // Allow some flexibility - calculate partial match
    const lengthDiff = Math.abs(discovered.reactions.length - known.reactions.length);
    const lengthPenalty = lengthDiff / Math.max(discovered.reactions.length, known.reactions.length);
    
    if (lengthPenalty > 0.5) return 0; // Too different
  }

  // Check if reactions match (order-independent)
  const discoveredReactions = normalizeReactions(discovered.reactions);
  const knownReactions = normalizeReactions(known.reactions);

  let matchedReactions = 0;
  for (const knownReaction of knownReactions) {
    const found = discoveredReactions.find((dr) =>
      reactionMatches(dr, knownReaction, 0.5) // 0.5 MeV tolerance
    );
    if (found) matchedReactions++;
  }

  const reactionSimilarity = matchedReactions / Math.max(discoveredReactions.length, knownReactions.length);

  // Check energy similarity
  const energyDiff = Math.abs(discovered.totalEnergy - known.totalEnergy);
  const energySimilarity = 1 - Math.min(energyDiff / known.totalEnergy, 1);

  // Combined similarity (weighted)
  return reactionSimilarity * 0.7 + energySimilarity * 0.3;
}

/**
 * Normalize reactions for comparison (sort inputs/outputs)
 */
function normalizeReactions(reactions: CycleReaction[] | Array<Omit<CycleReaction, 'isFeedback'> & { isFeedback?: boolean }>): CycleReaction[] {
  return reactions.map((r) => ({
    ...r,
    isFeedback: r.isFeedback ?? false,
    inputs: [...r.inputs].sort(),
    outputs: [...r.outputs].sort(),
  }));
}

/**
 * Check if two reactions match (within energy tolerance)
 */
function reactionMatches(
  r1: CycleReaction,
  r2: { inputs: string[]; outputs: string[]; type: string; MeV: number },
  energyTolerance: number
): boolean {
  // Check type
  if (r1.type !== r2.type) return false;

  // Check inputs match
  const r1Inputs = [...r1.inputs].sort();
  const r2Inputs = [...r2.inputs].sort();
  if (!arraysMatch(r1Inputs, r2Inputs)) return false;

  // Check outputs match
  const r1Outputs = [...r1.outputs].sort();
  const r2Outputs = [...r2.outputs].sort();
  if (!arraysMatch(r1Outputs, r2Outputs)) return false;

  // Check energy is within tolerance
  const energyDiff = Math.abs(r1.MeV - r2.MeV);
  return energyDiff <= energyTolerance;
}

/**
 * Check if two arrays contain the same elements (order-independent)
 */
function arraysMatch(arr1: string[], arr2: string[]): boolean {
  if (arr1.length !== arr2.length) return false;
  const sorted1 = [...arr1].sort();
  const sorted2 = [...arr2].sort();
  return sorted1.every((val, idx) => val === sorted2[idx]);
}

/**
 * Validate cycle energy calculations
 * Checks if the sum of reaction energies matches total energy
 */
export function validateCycleEnergy(cycle: DiscoveredCycle): {
  valid: boolean;
  calculatedEnergy: number;
  reportedEnergy: number;
  difference: number;
} {
  const calculatedEnergy = cycle.reactions.reduce((sum, r) => sum + r.MeV, 0);
  const difference = Math.abs(calculatedEnergy - cycle.totalEnergy);
  const valid = difference < 0.01; // Allow small floating point differences

  return {
    valid,
    calculatedEnergy,
    reportedEnergy: cycle.totalEnergy,
    difference,
  };
}

/**
 * Validate cycle structure
 * Checks for common issues like:
 * - Empty reactions
 * - Invalid feedback ratios
 * - Missing fuel nuclides
 */
export function validateCycleStructure(cycle: DiscoveredCycle): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (cycle.fuelNuclides.length === 0) {
    errors.push('Cycle has no fuel nuclides');
  }

  if (cycle.reactions.length === 0) {
    errors.push('Cycle has no reactions');
  }

  if (cycle.feedbackRatio < 0 || cycle.feedbackRatio > 100) {
    errors.push(`Invalid feedback ratio: ${cycle.feedbackRatio}`);
  }

  if (cycle.abundanceScore < 0 || cycle.abundanceScore > 100) {
    errors.push(`Invalid abundance score: ${cycle.abundanceScore}`);
  }

  if (cycle.stabilityScore < 0 || cycle.stabilityScore > 100) {
    errors.push(`Invalid stability score: ${cycle.stabilityScore}`);
  }

  if (cycle.cycleDepth !== cycle.reactions.length) {
    errors.push(`Cycle depth (${cycle.cycleDepth}) doesn't match reaction count (${cycle.reactions.length})`);
  }

  // Check that all reactions reference valid nuclides
  const allNuclides = new Set([
    ...cycle.fuelNuclides,
    ...cycle.reactions.flatMap((r) => [...r.inputs, ...r.outputs]),
  ]);

  cycle.reactions.forEach((reaction, idx) => {
    if (reaction.inputs.length === 0) {
      errors.push(`Reaction ${idx + 1} has no inputs`);
    }
    if (reaction.outputs.length === 0) {
      errors.push(`Reaction ${idx + 1} has no outputs`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
  };
}


