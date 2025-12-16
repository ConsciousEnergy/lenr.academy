/**
 * Cycle Discovery Service
 *
 * Searches the reaction database to identify fuel combinations that form
 * closed-loop reaction cycles (feedback loops). This inverts the cascade
 * simulation approach by finding cycles first, then identifying which fuels create them.
 *
 * Algorithm:
 * 1. Build reaction graph (nodes = nuclides, edges = reactions)
 * 2. For potential fuel combinations, use DFS to find cycles
 * 3. Filter cycles by depth, energy thresholds, and constraints
 * 4. Rank cycles by metrics (energy, feedback ratio, abundance, stability)
 */

import type { Database } from 'sql.js';
import type {
  CycleDiscoveryParameters,
  CycleDiscoveryResults,
  DiscoveredCycle,
  CycleReaction,
  FusionReaction,
  FissionReaction,
  TwoToTwoReaction,
  Nuclide,
} from '../types';
import { queryFusion, queryTwoToTwo, queryFission, getAllNuclides } from './queryService';

/**
 * Build nuclide ID from element symbol and mass number
 */
function buildNuclideId(E: string, A: number): string {
  return `${E}-${A}`;
}

/**
 * Parse nuclide ID to element symbol and mass number
 */
function parseNuclideId(nuclideId: string): { E: string; A: number } {
  const parts = nuclideId.split('-');
  if (parts.length !== 2) {
    throw new Error(`Invalid nuclide ID: ${nuclideId}`);
  }
  return { E: parts[0], A: parseInt(parts[1], 10) };
}

/**
 * Reaction graph edge representing a reaction
 */
interface ReactionEdge {
  type: 'fusion' | 'twotwo' | 'fission';
  inputs: string[];
  outputs: string[];
  MeV: number;
}

/**
 * Reaction graph structure
 */
interface ReactionGraph {
  edges: Map<string, ReactionEdge[]>; // nuclideId → array of reactions where it's an input
  allEdges: ReactionEdge[]; // All reactions for quick iteration
}

/**
 * Build reaction graph from database queries
 */
async function buildReactionGraph(
  db: Database,
  params: CycleDiscoveryParameters
): Promise<ReactionGraph> {
  const graph: ReactionGraph = {
    edges: new Map(),
    allEdges: [],
  };

  // Query fusion reactions
  const fusionResult = queryFusion(db, {
    minMeV: params.minFusionMeV,
    limit: 0, // No limit
  });

  for (const reaction of fusionResult.reactions) {
    const input1 = buildNuclideId(reaction.E1, reaction.A1);
    const input2 = buildNuclideId(reaction.E2, reaction.A2);
    const output = buildNuclideId(reaction.E, reaction.A);

    const edge: ReactionEdge = {
      type: 'fusion',
      inputs: [input1, input2],
      outputs: [output],
      MeV: reaction.MeV,
    };

    graph.allEdges.push(edge);

    // Add to graph for both inputs
    if (!graph.edges.has(input1)) {
      graph.edges.set(input1, []);
    }
    graph.edges.get(input1)!.push(edge);

    if (!graph.edges.has(input2)) {
      graph.edges.set(input2, []);
    }
    graph.edges.get(input2)!.push(edge);
  }

  // Query two-to-two reactions
  const twoToTwoResult = queryTwoToTwo(db, {
    minMeV: params.minTwoToTwoMeV,
    limit: 0, // No limit
  });

  for (const reaction of twoToTwoResult.reactions) {
    const input1 = buildNuclideId(reaction.E1, reaction.A1);
    const input2 = buildNuclideId(reaction.E2, reaction.A2);
    const output1 = buildNuclideId(reaction.E3, reaction.A3);
    const output2 = buildNuclideId(reaction.E4, reaction.A4);

    const edge: ReactionEdge = {
      type: 'twotwo',
      inputs: [input1, input2],
      outputs: [output1, output2],
      MeV: reaction.MeV,
    };

    graph.allEdges.push(edge);

    // Add to graph for both inputs
    if (!graph.edges.has(input1)) {
      graph.edges.set(input1, []);
    }
    graph.edges.get(input1)!.push(edge);

    if (!graph.edges.has(input2)) {
      graph.edges.set(input2, []);
    }
    graph.edges.get(input2)!.push(edge);
  }

  // Query fission reactions if enabled
  if (params.includeFission) {
    const fissionResult = queryFission(db, {
      minMeV: params.minFissionMeV ?? params.minFusionMeV,
      limit: 0, // No limit
    });

    for (const reaction of fissionResult.reactions) {
      const input = buildNuclideId(reaction.E, reaction.A);
      const output1 = buildNuclideId(reaction.E1, reaction.A1);
      const output2 = buildNuclideId(reaction.E2, reaction.A2);

      const edge: ReactionEdge = {
        type: 'fission',
        inputs: [input],
        outputs: [output1, output2],
        MeV: reaction.MeV,
      };

      graph.allEdges.push(edge);

      // Add to graph for input
      if (!graph.edges.has(input)) {
        graph.edges.set(input, []);
      }
      graph.edges.get(input)!.push(edge);
    }
  }

  return graph;
}

/**
 * Check if a nuclide passes element filters
 */
function passesElementFilters(
  nuclideId: string,
  nuclides: Map<string, Nuclide>,
  filters?: CycleDiscoveryParameters['elementFilters']
): boolean {
  if (!filters) return true;

  const nuclide = nuclides.get(nuclideId);
  if (!nuclide) return false;

  // Check allowed elements
  if (filters.allowedElements && filters.allowedElements.length > 0) {
    if (!filters.allowedElements.includes(nuclide.E)) {
      return false;
    }
  }

  // Check exclude radioactive
  if (filters.excludeRadioactive) {
    // Consider stable if logHalfLife > 9 (half-life > 1 billion years)
    if (nuclide.logHalfLife !== undefined && nuclide.logHalfLife <= 9) {
      return false;
    }
  }

  // Check abundant only (using solar abundance as proxy)
  if (filters.abundantOnly) {
    // Consider abundant if ppmNSolar > 0.1
    if (!nuclide.ppmNSolar || nuclide.ppmNSolar < 0.1) {
      return false;
    }
  }

  return true;
}

/**
 * Find cycles starting from given fuel nuclides using DFS
 */
function findCyclesFromFuel(
  graph: ReactionGraph,
  fuelNuclides: string[],
  maxDepth: number,
  nuclides: Map<string, Nuclide>,
  filters?: CycleDiscoveryParameters['elementFilters']
): DiscoveredCycle[] {
  const cycles: DiscoveredCycle[] = [];
  const fuelSet = new Set(fuelNuclides);

  // DFS to find cycles
  function dfs(
    currentNuclide: string,
    path: CycleReaction[],
    visited: Set<string>,
    depth: number
  ): void {
    if (depth > maxDepth) return;

    // Get all reactions where currentNuclide is an input
    const reactions = graph.edges.get(currentNuclide) || [];

    for (const edge of reactions) {
      // Check if we can use this reaction (both inputs must be available)
      const canUseReaction = edge.inputs.every(
        (input) => fuelSet.has(input) || visited.has(input)
      );

      if (!canUseReaction) continue;

      // Check if outputs pass filters
      const outputsPassFilter = edge.outputs.every((output) =>
        passesElementFilters(output, nuclides, filters)
      );

      if (!outputsPassFilter) continue;

      // Create cycle reaction
      const cycleReaction: CycleReaction = {
        type: edge.type,
        inputs: [...edge.inputs],
        outputs: [...edge.outputs],
        MeV: edge.MeV,
        isFeedback: edge.outputs.some((output) => visited.has(output) || fuelSet.has(output)),
      };

      const newPath = [...path, cycleReaction];
      const newVisited = new Set(visited);
      edge.outputs.forEach((output) => newVisited.add(output));

      // Check if any output can react with fuel (cycle detected)
      for (const output of edge.outputs) {
        if (fuelSet.has(output)) {
          // Found a cycle! Output is in the fuel set, meaning it can react with fuel again
          // Only add if we have at least one reaction in the path
          if (newPath.length > 0) {
            const cycle: DiscoveredCycle = {
              id: `cycle-${cycles.length + 1}`,
              fuelNuclides: [...fuelNuclides],
              reactions: newPath,
              totalEnergy: newPath.reduce((sum, r) => sum + r.MeV, 0),
              feedbackRatio: 0, // Will calculate later
              cycleDepth: newPath.length,
              abundanceScore: 0, // Will calculate later
              stabilityScore: 0, // Will calculate later
            };

            // Calculate feedback ratio
            const feedbackReactions = newPath.filter((r) => r.isFeedback).length;
            cycle.feedbackRatio = newPath.length > 0 ? (feedbackReactions / newPath.length) * 100 : 0;

            cycles.push(cycle);
          }
        } else if (!visited.has(output)) {
          // Continue DFS from this output
          dfs(output, newPath, newVisited, depth + 1);
        }
      }
    }
  }

  // Start DFS from each fuel nuclide
  for (const fuel of fuelNuclides) {
    if (passesElementFilters(fuel, nuclides, filters)) {
      dfs(fuel, [], new Set([fuel]), 1);
    }
  }

  return cycles;
}

/**
 * Calculate abundance score for a cycle (0-100)
 */
function calculateAbundanceScore(
  cycle: DiscoveredCycle,
  nuclides: Map<string, Nuclide>
): number {
  const allNuclides = new Set<string>([
    ...cycle.fuelNuclides,
    ...cycle.reactions.flatMap((r) => [...r.inputs, ...r.outputs]),
  ]);

  let totalAbundance = 0;
  let count = 0;

  for (const nuclideId of allNuclides) {
    const nuclide = nuclides.get(nuclideId);
    if (nuclide && nuclide.ppmNSolar !== undefined) {
      // Use solar abundance as proxy for natural abundance
      totalAbundance += Math.log10(nuclide.ppmNSolar + 1); // Log scale to handle wide range
      count++;
    }
  }

  if (count === 0) return 0;

  const avgAbundance = totalAbundance / count;
  // Normalize to 0-100 scale (assuming max log abundance ~ 6 for common elements)
  return Math.min(100, (avgAbundance / 6) * 100);
}

/**
 * Calculate stability score for a cycle (0-100)
 * Higher score = fewer rare/radioactive isotopes
 */
function calculateStabilityScore(
  cycle: DiscoveredCycle,
  nuclides: Map<string, Nuclide>
): number {
  const allNuclides = new Set<string>([
    ...cycle.fuelNuclides,
    ...cycle.reactions.flatMap((r) => [...r.inputs, ...r.outputs]),
  ]);

  let stableCount = 0;
  let totalCount = 0;

  for (const nuclideId of allNuclides) {
    const nuclide = nuclides.get(nuclideId);
    if (nuclide) {
      totalCount++;
      // Consider stable if logHalfLife > 9 (half-life > 1 billion years) or undefined
      if (nuclide.logHalfLife === undefined || nuclide.logHalfLife > 9) {
        stableCount++;
      }
    }
  }

  if (totalCount === 0) return 0;
  return (stableCount / totalCount) * 100;
}

/**
 * Rank cycles by multiple criteria
 */
function rankCycles(cycles: DiscoveredCycle[]): DiscoveredCycle[] {
  return cycles.sort((a, b) => {
    // Primary sort: total energy (descending)
    if (Math.abs(a.totalEnergy - b.totalEnergy) > 0.1) {
      return b.totalEnergy - a.totalEnergy;
    }

    // Secondary sort: feedback ratio (descending)
    if (Math.abs(a.feedbackRatio - b.feedbackRatio) > 0.1) {
      return b.feedbackRatio - a.feedbackRatio;
    }

    // Tertiary sort: abundance score (descending)
    if (Math.abs(a.abundanceScore - b.abundanceScore) > 0.1) {
      return b.abundanceScore - a.abundanceScore;
    }

    // Final sort: stability score (descending)
    return b.stabilityScore - a.stabilityScore;
  });
}

/**
 * Generate potential fuel combinations from available nuclides
 * For now, we'll use a simple approach: single nuclides and pairs
 * This can be expanded later for more complex combinations
 */
function generateFuelCombinations(
  nuclides: Map<string, Nuclide>,
  filters?: CycleDiscoveryParameters['elementFilters']
): string[][] {
  const combinations: string[][] = [];
  const validNuclides: string[] = [];

  // Collect valid nuclides
  for (const [nuclideId, nuclide] of nuclides.entries()) {
    if (passesElementFilters(nuclideId, nuclides, filters)) {
      validNuclides.push(nuclideId);
    }
  }

  // Single nuclide combinations
  for (const nuclide of validNuclides) {
    combinations.push([nuclide]);
  }

  // Pair combinations (limit to avoid explosion)
  // For performance, limit to first 50 nuclides for pairing
  const limitedNuclides = validNuclides.slice(0, 50);
  for (let i = 0; i < limitedNuclides.length; i++) {
    for (let j = i; j < limitedNuclides.length; j++) {
      combinations.push([limitedNuclides[i], limitedNuclides[j]]);
    }
  }

  return combinations;
}

/**
 * Discover cycles in the reaction database
 */
export async function discoverCycles(
  db: Database,
  params: CycleDiscoveryParameters
): Promise<CycleDiscoveryResults> {
  const startTime = performance.now();

  // Build reaction graph
  const graph = await buildReactionGraph(db, params);

  // Get all nuclides for filtering and scoring
  const allNuclides = getAllNuclides(db);
  const nuclidesMap = new Map<string, Nuclide>();
  for (const nuclide of allNuclides) {
    nuclidesMap.set(buildNuclideId(nuclide.E, nuclide.A), nuclide);
  }

  // Generate potential fuel combinations
  const fuelCombinations = generateFuelCombinations(nuclidesMap, params.elementFilters);

  // Find cycles for each fuel combination
  const allCycles: DiscoveredCycle[] = [];
  const cycleIds = new Set<string>();

  for (const fuelCombo of fuelCombinations) {
    const cycles = findCyclesFromFuel(
      graph,
      fuelCombo,
      params.maxCycleDepth,
      nuclidesMap,
      params.elementFilters
    );

    for (const cycle of cycles) {
      // Create unique ID based on fuel and reactions
      const cycleKey = `${fuelCombo.sort().join('+')}-${cycle.reactions
        .map((r) => `${r.inputs.join('+')}→${r.outputs.join('+')}`)
        .join('|')}`;

      if (!cycleIds.has(cycleKey)) {
        cycleIds.add(cycleKey);
        cycle.id = `cycle-${allCycles.length + 1}`;

        // Calculate scores
        cycle.abundanceScore = calculateAbundanceScore(cycle, nuclidesMap);
        cycle.stabilityScore = calculateStabilityScore(cycle, nuclidesMap);

        allCycles.push(cycle);
      }
    }

    // Early termination if we've found enough cycles
    if (allCycles.length >= params.maxCycles * 2) {
      break;
    }
  }

  // Rank cycles
  const rankedCycles = rankCycles(allCycles);

  // Limit to maxCycles
  const limitedCycles = rankedCycles.slice(0, params.maxCycles);

  const executionTime = performance.now() - startTime;

  return {
    cycles: limitedCycles,
    executionTime,
    totalCyclesFound: allCycles.length,
  };
}

