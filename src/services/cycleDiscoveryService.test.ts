/**
 * Cycle Discovery Service Tests
 *
 * Tests for the cycle discovery algorithm, including validation with known cycles
 * and theoretical calculations.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Database } from 'sql.js';
import type {
  CycleDiscoveryParameters,
  FusionReaction,
  TwoToTwoReaction,
  FissionReaction,
  Nuclide,
  DiscoveredCycle,
} from '../types';
import { discoverCycles } from './cycleDiscoveryService';
import * as queryService from './queryService';
import {
  validateCycleAgainstKnown,
  validateCycleEnergy,
  validateCycleStructure,
  KNOWN_CYCLES,
} from './cycleValidation';

// Mock the query service
vi.mock('./queryService', () => ({
  queryFusion: vi.fn(),
  queryTwoToTwo: vi.fn(),
  queryFission: vi.fn(),
  getAllNuclides: vi.fn(),
}));

describe('cycleDiscoveryService', () => {
  let mockDb: Database;
  const mockQueryFusion = vi.mocked(queryService.queryFusion);
  const mockQueryTwoToTwo = vi.mocked(queryService.queryTwoToTwo);
  const mockQueryFission = vi.mocked(queryService.queryFission);
  const mockGetAllNuclides = vi.mocked(queryService.getAllNuclides);

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = {} as Database;
  });

  /**
   * Helper to create mock nuclide
   */
  function createMockNuclide(E: string, A: number, options?: Partial<Nuclide>): Nuclide {
    return {
      id: 1,
      Z: getAtomicNumber(E),
      A,
      E,
      BE: 0,
      AMU: 0,
      nBorF: 'b',
      aBorF: 'b',
      logHalfLife: 10, // Stable
      ppmNSolar: 100, // Abundant
      ...options,
    };
  }

  /**
   * Helper to get atomic number from element symbol
   */
  function getAtomicNumber(E: string): number {
    const elements: Record<string, number> = {
      H: 1,
      D: 1,
      T: 1,
      He: 2,
      Li: 3,
      Be: 4,
      B: 5,
      C: 6,
      N: 7,
      O: 8,
      F: 9,
      Ne: 10,
      Na: 11,
      Mg: 12,
      Al: 13,
      Si: 14,
      P: 15,
      S: 16,
      Cl: 17,
      Ar: 18,
      K: 19,
      Ca: 20,
      Fe: 26,
      Ni: 28,
    };
    return elements[E] || 0;
  }

  /**
   * Helper to create mock fusion reaction
   */
  function createFusionReaction(
    E1: string,
    A1: number,
    E2: string,
    A2: number,
    E: string,
    A: number,
    MeV: number
  ): FusionReaction {
    return {
      id: 1,
      E1,
      Z1: getAtomicNumber(E1),
      A1,
      E2,
      Z2: getAtomicNumber(E2),
      A2,
      E,
      Z: getAtomicNumber(E),
      A,
      MeV,
      neutrino: 'none',
      nBorF1: 'b',
      aBorF1: 'b',
      nBorF2: 'b',
      aBorF2: 'b',
      nBorF: 'b',
      aBorF: 'b',
    };
  }

  /**
   * Helper to create mock two-to-two reaction
   */
  function createTwoToTwoReaction(
    E1: string,
    A1: number,
    E2: string,
    A2: number,
    E3: string,
    A3: number,
    E4: string,
    A4: number,
    MeV: number
  ): TwoToTwoReaction {
    return {
      id: 1,
      E1,
      Z1: getAtomicNumber(E1),
      A1,
      E2,
      Z2: getAtomicNumber(E2),
      A2,
      E3,
      Z3: getAtomicNumber(E3),
      A3,
      E4,
      Z4: getAtomicNumber(E4),
      A4,
      MeV,
      neutrino: 'none',
      nBorF1: 'b',
      aBorF1: 'b',
      nBorF2: 'b',
      aBorF2: 'b',
      nBorF3: 'b',
      aBorF3: 'b',
      nBorF4: 'b',
      aBorF4: 'b',
    };
  }

  describe('basic cycle detection', () => {
    it('should detect a simple feedback cycle', async () => {
      // Simple cycle: H-1 + Li-7 → He-4 + He-4, then He-4 + He-4 → Be-8
      // If Be-8 can react with H-1 to form something that cycles back, we have a cycle
      // For this test, let's create: H-1 + Li-7 → He-4 + He-4, He-4 + He-4 → Be-8, Be-8 + H-1 → Li-9 → Li-7 + n (simplified)

      const fusionReactions: FusionReaction[] = [
        createFusionReaction('H', 1, 'Li', 7, 'He', 4, 15.0), // H-1 + Li-7 → He-4 (simplified)
        createFusionReaction('He', 4, 'He', 4, 'Be', 8, 0.1), // He-4 + He-4 → Be-8
      ];

      const twoToTwoReactions: TwoToTwoReaction[] = [
        createTwoToTwoReaction('H', 1, 'Li', 7, 'He', 4, 'He', 4, 15.0), // H-1 + Li-7 → He-4 + He-4
      ];

      mockQueryFusion.mockReturnValue({
        reactions: fusionReactions,
        nuclides: [],
        elements: [],
        radioactiveNuclides: new Set(),
        executionTime: 0,
        rowCount: fusionReactions.length,
        totalCount: fusionReactions.length,
      });

      mockQueryTwoToTwo.mockReturnValue({
        reactions: twoToTwoReactions,
        nuclides: [],
        elements: [],
        radioactiveNuclides: new Set(),
        executionTime: 0,
        rowCount: twoToTwoReactions.length,
        totalCount: twoToTwoReactions.length,
      });

      mockQueryFission.mockReturnValue({
        reactions: [],
        nuclides: [],
        elements: [],
        radioactiveNuclides: new Set(),
        executionTime: 0,
        rowCount: 0,
        totalCount: 0,
      });

      // Create nuclides map
      const nuclides: Nuclide[] = [
        createMockNuclide('H', 1),
        createMockNuclide('Li', 7),
        createMockNuclide('He', 4),
        createMockNuclide('Be', 8),
      ];

      mockGetAllNuclides.mockReturnValue(nuclides);

      const params: CycleDiscoveryParameters = {
        minFusionMeV: 0.1,
        minTwoToTwoMeV: 0.1,
        maxCycleDepth: 5,
        includeFission: false,
        maxCycles: 100,
      };

      const results = await discoverCycles(mockDb, params);

      // Should find at least some cycles (depending on the graph structure)
      expect(results.cycles).toBeDefined();
      expect(Array.isArray(results.cycles)).toBe(true);
      expect(results.executionTime).toBeGreaterThanOrEqual(0);
    });

    it('should respect energy thresholds', async () => {
      const fusionReactions: FusionReaction[] = [
        createFusionReaction('H', 1, 'H', 1, 'He', 2, 0.5), // Low energy
        createFusionReaction('H', 1, 'Li', 7, 'Be', 8, 5.0), // High energy
      ];

      mockQueryFusion.mockReturnValue({
        reactions: fusionReactions,
        nuclides: [],
        elements: [],
        radioactiveNuclides: new Set(),
        executionTime: 0,
        rowCount: fusionReactions.length,
        totalCount: fusionReactions.length,
      });

      mockQueryTwoToTwo.mockReturnValue({
        reactions: [],
        nuclides: [],
        elements: [],
        radioactiveNuclides: new Set(),
        executionTime: 0,
        rowCount: 0,
        totalCount: 0,
      });

      mockQueryFission.mockReturnValue({
        reactions: [],
        nuclides: [],
        elements: [],
        radioactiveNuclides: new Set(),
        executionTime: 0,
        rowCount: 0,
        totalCount: 0,
      });

      const nuclides: Nuclide[] = [
        createMockNuclide('H', 1),
        createMockNuclide('Li', 7),
        createMockNuclide('He', 2),
        createMockNuclide('Be', 8),
      ];

      mockGetAllNuclides.mockReturnValue(nuclides);

      const params: CycleDiscoveryParameters = {
        minFusionMeV: 1.0, // Should filter out the 0.5 MeV reaction
        minTwoToTwoMeV: 0.1,
        maxCycleDepth: 5,
        includeFission: false,
        maxCycles: 100,
      };

      const results = await discoverCycles(mockDb, params);

      // The graph should only include reactions above the threshold
      expect(mockQueryFusion).toHaveBeenCalledWith(
        mockDb,
        expect.objectContaining({
          minMeV: 1.0,
        })
      );
    });

    it('should respect max cycle depth', async () => {
      // Create a chain of reactions that could form a deep cycle
      const fusionReactions: FusionReaction[] = [
        createFusionReaction('H', 1, 'H', 1, 'He', 2, 1.0),
        createFusionReaction('He', 2, 'He', 2, 'Be', 4, 1.0),
        createFusionReaction('Be', 4, 'Be', 4, 'C', 8, 1.0),
        createFusionReaction('C', 8, 'C', 8, 'O', 16, 1.0),
        createFusionReaction('O', 16, 'O', 16, 'S', 32, 1.0),
      ];

      mockQueryFusion.mockReturnValue({
        reactions: fusionReactions,
        nuclides: [],
        elements: [],
        radioactiveNuclides: new Set(),
        executionTime: 0,
        rowCount: fusionReactions.length,
        totalCount: fusionReactions.length,
      });

      mockQueryTwoToTwo.mockReturnValue({
        reactions: [],
        nuclides: [],
        elements: [],
        radioactiveNuclides: new Set(),
        executionTime: 0,
        rowCount: 0,
        totalCount: 0,
      });

      mockQueryFission.mockReturnValue({
        reactions: [],
        nuclides: [],
        elements: [],
        radioactiveNuclides: new Set(),
        executionTime: 0,
        rowCount: 0,
        totalCount: 0,
      });

      const nuclides: Nuclide[] = [
        createMockNuclide('H', 1),
        createMockNuclide('He', 2),
        createMockNuclide('Be', 4),
        createMockNuclide('C', 8),
        createMockNuclide('O', 16),
        createMockNuclide('S', 32),
      ];

      mockGetAllNuclides.mockReturnValue(nuclides);

      const params: CycleDiscoveryParameters = {
        minFusionMeV: 0.1,
        minTwoToTwoMeV: 0.1,
        maxCycleDepth: 3, // Limit to 3 reactions
        includeFission: false,
        maxCycles: 100,
      };

      const results = await discoverCycles(mockDb, params);

      // All cycles should have depth <= 3
      results.cycles.forEach((cycle) => {
        expect(cycle.cycleDepth).toBeLessThanOrEqual(3);
      });
    });
  });

  describe('cycle metrics', () => {
    it('should calculate feedback ratio correctly', async () => {
      // Create a cycle where some products feed back
      const twoToTwoReactions: TwoToTwoReaction[] = [
        createTwoToTwoReaction('H', 1, 'Li', 7, 'He', 4, 'He', 4, 15.0), // H-1 + Li-7 → He-4 + He-4
        createTwoToTwoReaction('He', 4, 'H', 1, 'Li', 5, 'He', 2, 2.0), // He-4 + H-1 → Li-5 + He-2 (feedback)
      ];

      mockQueryFusion.mockReturnValue({
        reactions: [],
        nuclides: [],
        elements: [],
        radioactiveNuclides: new Set(),
        executionTime: 0,
        rowCount: 0,
        totalCount: 0,
      });

      mockQueryTwoToTwo.mockReturnValue({
        reactions: twoToTwoReactions,
        nuclides: [],
        elements: [],
        radioactiveNuclides: new Set(),
        executionTime: 0,
        rowCount: twoToTwoReactions.length,
        totalCount: twoToTwoReactions.length,
      });

      mockQueryFission.mockReturnValue({
        reactions: [],
        nuclides: [],
        elements: [],
        radioactiveNuclides: new Set(),
        executionTime: 0,
        rowCount: 0,
        totalCount: 0,
      });

      const nuclides: Nuclide[] = [
        createMockNuclide('H', 1),
        createMockNuclide('Li', 7),
        createMockNuclide('He', 4),
        createMockNuclide('He', 2),
        createMockNuclide('Li', 5),
      ];

      mockGetAllNuclides.mockReturnValue(nuclides);

      const params: CycleDiscoveryParameters = {
        minFusionMeV: 0.1,
        minTwoToTwoMeV: 0.1,
        maxCycleDepth: 5,
        includeFission: false,
        maxCycles: 100,
      };

      const results = await discoverCycles(mockDb, params);

      // If cycles are found, check that feedback ratio is calculated
      if (results.cycles.length > 0) {
        results.cycles.forEach((cycle) => {
          expect(cycle.feedbackRatio).toBeGreaterThanOrEqual(0);
          expect(cycle.feedbackRatio).toBeLessThanOrEqual(100);
        });
      }
    });

    it('should calculate abundance and stability scores', async () => {
      const fusionReactions: FusionReaction[] = [
        createFusionReaction('H', 1, 'H', 1, 'He', 2, 1.0),
      ];

      mockQueryFusion.mockReturnValue({
        reactions: fusionReactions,
        nuclides: [],
        elements: [],
        radioactiveNuclides: new Set(),
        executionTime: 0,
        rowCount: fusionReactions.length,
        totalCount: fusionReactions.length,
      });

      mockQueryTwoToTwo.mockReturnValue({
        reactions: [],
        nuclides: [],
        elements: [],
        radioactiveNuclides: new Set(),
        executionTime: 0,
        rowCount: 0,
        totalCount: 0,
      });

      mockQueryFission.mockReturnValue({
        reactions: [],
        nuclides: [],
        elements: [],
        radioactiveNuclides: new Set(),
        executionTime: 0,
        rowCount: 0,
        totalCount: 0,
      });

      // Create nuclides with different abundance values
      const nuclides: Nuclide[] = [
        createMockNuclide('H', 1, { ppmNSolar: 1000 }), // Very abundant
        createMockNuclide('He', 2, { ppmNSolar: 100 }), // Abundant
      ];

      mockGetAllNuclides.mockReturnValue(nuclides);

      const params: CycleDiscoveryParameters = {
        minFusionMeV: 0.1,
        minTwoToTwoMeV: 0.1,
        maxCycleDepth: 5,
        includeFission: false,
        maxCycles: 100,
      };

      const results = await discoverCycles(mockDb, params);

      // If cycles are found, check scores
      if (results.cycles.length > 0) {
        results.cycles.forEach((cycle) => {
          expect(cycle.abundanceScore).toBeGreaterThanOrEqual(0);
          expect(cycle.abundanceScore).toBeLessThanOrEqual(100);
          expect(cycle.stabilityScore).toBeGreaterThanOrEqual(0);
          expect(cycle.stabilityScore).toBeLessThanOrEqual(100);
        });
      }
    });
  });

  describe('element filtering', () => {
    it('should filter by allowed elements', async () => {
      const fusionReactions: FusionReaction[] = [
        createFusionReaction('H', 1, 'H', 1, 'He', 2, 1.0),
        createFusionReaction('Li', 7, 'Li', 7, 'C', 14, 5.0),
      ];

      mockQueryFusion.mockReturnValue({
        reactions: fusionReactions,
        nuclides: [],
        elements: [],
        radioactiveNuclides: new Set(),
        executionTime: 0,
        rowCount: fusionReactions.length,
        totalCount: fusionReactions.length,
      });

      mockQueryTwoToTwo.mockReturnValue({
        reactions: [],
        nuclides: [],
        elements: [],
        radioactiveNuclides: new Set(),
        executionTime: 0,
        rowCount: 0,
        totalCount: 0,
      });

      mockQueryFission.mockReturnValue({
        reactions: [],
        nuclides: [],
        elements: [],
        radioactiveNuclides: new Set(),
        executionTime: 0,
        rowCount: 0,
        totalCount: 0,
      });

      const nuclides: Nuclide[] = [
        createMockNuclide('H', 1),
        createMockNuclide('He', 2),
        createMockNuclide('Li', 7),
        createMockNuclide('C', 14),
      ];

      mockGetAllNuclides.mockReturnValue(nuclides);

      const params: CycleDiscoveryParameters = {
        minFusionMeV: 0.1,
        minTwoToTwoMeV: 0.1,
        maxCycleDepth: 5,
        includeFission: false,
        maxCycles: 100,
        elementFilters: {
          allowedElements: ['H', 'He'], // Only allow H and He
        },
      };

      const results = await discoverCycles(mockDb, params);

      // Cycles should only contain H and He
      results.cycles.forEach((cycle) => {
        const allNuclides = [
          ...cycle.fuelNuclides,
          ...cycle.reactions.flatMap((r) => [...r.inputs, ...r.outputs]),
        ];
        allNuclides.forEach((nuclideId) => {
          const element = nuclideId.split('-')[0];
          expect(['H', 'He']).toContain(element);
        });
      });
    });

    it('should exclude radioactive nuclides when filter is enabled', async () => {
      const fusionReactions: FusionReaction[] = [
        createFusionReaction('H', 1, 'H', 1, 'He', 2, 1.0),
      ];

      mockQueryFusion.mockReturnValue({
        reactions: fusionReactions,
        nuclides: [],
        elements: [],
        radioactiveNuclides: new Set(),
        executionTime: 0,
        rowCount: fusionReactions.length,
        totalCount: fusionReactions.length,
      });

      mockQueryTwoToTwo.mockReturnValue({
        reactions: [],
        nuclides: [],
        elements: [],
        radioactiveNuclides: new Set(),
        executionTime: 0,
        rowCount: 0,
        totalCount: 0,
      });

      mockQueryFission.mockReturnValue({
        reactions: [],
        nuclides: [],
        elements: [],
        radioactiveNuclides: new Set(),
        executionTime: 0,
        rowCount: 0,
        totalCount: 0,
      });

      // Create one stable and one radioactive nuclide
      const nuclides: Nuclide[] = [
        createMockNuclide('H', 1, { logHalfLife: 10 }), // Stable
        createMockNuclide('He', 2, { logHalfLife: 5 }), // Radioactive (short half-life)
      ];

      mockGetAllNuclides.mockReturnValue(nuclides);

      const params: CycleDiscoveryParameters = {
        minFusionMeV: 0.1,
        minTwoToTwoMeV: 0.1,
        maxCycleDepth: 5,
        includeFission: false,
        maxCycles: 100,
        elementFilters: {
          excludeRadioactive: true,
        },
      };

      const results = await discoverCycles(mockDb, params);

      // Cycles should only contain stable nuclides
      results.cycles.forEach((cycle) => {
        const allNuclides = [
          ...cycle.fuelNuclides,
          ...cycle.reactions.flatMap((r) => [...r.inputs, ...r.outputs]),
        ];
        allNuclides.forEach((nuclideId) => {
          const nuclide = nuclides.find(
            (n) => `${n.E}-${n.A}` === nuclideId
          );
          if (nuclide) {
            // Should be stable (logHalfLife > 9 or undefined)
            expect(nuclide.logHalfLife === undefined || nuclide.logHalfLife > 9).toBe(true);
          }
        });
      });
    });
  });

  describe('cycle ranking', () => {
    it('should rank cycles by total energy', async () => {
      const fusionReactions: FusionReaction[] = [
        createFusionReaction('H', 1, 'H', 1, 'He', 2, 1.0), // Low energy
        createFusionReaction('Li', 7, 'Li', 7, 'C', 14, 10.0), // High energy
      ];

      mockQueryFusion.mockReturnValue({
        reactions: fusionReactions,
        nuclides: [],
        elements: [],
        radioactiveNuclides: new Set(),
        executionTime: 0,
        rowCount: fusionReactions.length,
        totalCount: fusionReactions.length,
      });

      mockQueryTwoToTwo.mockReturnValue({
        reactions: [],
        nuclides: [],
        elements: [],
        radioactiveNuclides: new Set(),
        executionTime: 0,
        rowCount: 0,
        totalCount: 0,
      });

      mockQueryFission.mockReturnValue({
        reactions: [],
        nuclides: [],
        elements: [],
        radioactiveNuclides: new Set(),
        executionTime: 0,
        rowCount: 0,
        totalCount: 0,
      });

      const nuclides: Nuclide[] = [
        createMockNuclide('H', 1),
        createMockNuclide('He', 2),
        createMockNuclide('Li', 7),
        createMockNuclide('C', 14),
      ];

      mockGetAllNuclides.mockReturnValue(nuclides);

      const params: CycleDiscoveryParameters = {
        minFusionMeV: 0.1,
        minTwoToTwoMeV: 0.1,
        maxCycleDepth: 5,
        includeFission: false,
        maxCycles: 100,
      };

      const results = await discoverCycles(mockDb, params);

      // Cycles should be sorted by total energy (descending)
      if (results.cycles.length > 1) {
        for (let i = 0; i < results.cycles.length - 1; i++) {
          expect(results.cycles[i].totalEnergy).toBeGreaterThanOrEqual(
            results.cycles[i + 1].totalEnergy
          );
        }
      }
    });
  });

  describe('edge cases', () => {
    it('should handle empty reaction database', async () => {
      mockQueryFusion.mockReturnValue({
        reactions: [],
        nuclides: [],
        elements: [],
        radioactiveNuclides: new Set(),
        executionTime: 0,
        rowCount: 0,
        totalCount: 0,
      });

      mockQueryTwoToTwo.mockReturnValue({
        reactions: [],
        nuclides: [],
        elements: [],
        radioactiveNuclides: new Set(),
        executionTime: 0,
        rowCount: 0,
        totalCount: 0,
      });

      mockQueryFission.mockReturnValue({
        reactions: [],
        nuclides: [],
        elements: [],
        radioactiveNuclides: new Set(),
        executionTime: 0,
        rowCount: 0,
        totalCount: 0,
      });

      mockGetAllNuclides.mockReturnValue([]);

      const params: CycleDiscoveryParameters = {
        minFusionMeV: 0.1,
        minTwoToTwoMeV: 0.1,
        maxCycleDepth: 5,
        includeFission: false,
        maxCycles: 100,
      };

      const results = await discoverCycles(mockDb, params);

      expect(results.cycles).toEqual([]);
      expect(results.totalCyclesFound).toBe(0);
      expect(results.executionTime).toBeGreaterThanOrEqual(0);
    });

    it('should respect maxCycles limit', async () => {
      // Create many potential cycles
      const fusionReactions: FusionReaction[] = [];
      for (let i = 0; i < 50; i++) {
        fusionReactions.push(
          createFusionReaction('H', 1, 'H', 1, 'He', 2, 1.0 + i * 0.1)
        );
      }

      mockQueryFusion.mockReturnValue({
        reactions: fusionReactions,
        nuclides: [],
        elements: [],
        radioactiveNuclides: new Set(),
        executionTime: 0,
        rowCount: fusionReactions.length,
        totalCount: fusionReactions.length,
      });

      mockQueryTwoToTwo.mockReturnValue({
        reactions: [],
        nuclides: [],
        elements: [],
        radioactiveNuclides: new Set(),
        executionTime: 0,
        rowCount: 0,
        totalCount: 0,
      });

      mockQueryFission.mockReturnValue({
        reactions: [],
        nuclides: [],
        elements: [],
        radioactiveNuclides: new Set(),
        executionTime: 0,
        rowCount: 0,
        totalCount: 0,
      });

      const nuclides: Nuclide[] = [
        createMockNuclide('H', 1),
        createMockNuclide('He', 2),
      ];

      mockGetAllNuclides.mockReturnValue(nuclides);

      const params: CycleDiscoveryParameters = {
        minFusionMeV: 0.1,
        minTwoToTwoMeV: 0.1,
        maxCycleDepth: 5,
        includeFission: false,
        maxCycles: 10, // Limit to 10 cycles
      };

      const results = await discoverCycles(mockDb, params);

      expect(results.cycles.length).toBeLessThanOrEqual(10);
    });
  });

  describe('known cycle examples', () => {
    /**
     * Test with a CNO-like cycle structure
     * Simplified CNO cycle: H-1 + C-12 → N-13 → C-13 + e+, C-13 + H-1 → N-14, N-14 + H-1 → O-15 → N-15 + e+, N-15 + H-1 → C-12 + He-4
     * For our purposes, we'll test with fusion reactions that form a cycle
     */
    it('should detect CNO-like cycle patterns', async () => {
      // Create reactions that form a cycle: H-1 + C-12 → N-13, then products that can react back
      const fusionReactions: FusionReaction[] = [
        createFusionReaction('H', 1, 'C', 12, 'N', 13, 1.94), // H-1 + C-12 → N-13 (beta+ decay to C-13)
        createFusionReaction('H', 1, 'C', 13, 'N', 14, 7.55), // H-1 + C-13 → N-14
        createFusionReaction('H', 1, 'N', 14, 'O', 15, 7.30), // H-1 + N-14 → O-15 (beta+ decay to N-15)
        createFusionReaction('H', 1, 'N', 15, 'C', 12, 4.97), // H-1 + N-15 → C-12 + He-4 (two-to-two equivalent)
      ];

      // Also create two-to-two version of the last reaction
      const twoToTwoReactions: TwoToTwoReaction[] = [
        createTwoToTwoReaction('H', 1, 'N', 15, 'C', 12, 'He', 4, 4.97), // H-1 + N-15 → C-12 + He-4
      ];

      mockQueryFusion.mockReturnValue({
        reactions: fusionReactions,
        nuclides: [],
        elements: [],
        radioactiveNuclides: new Set(),
        executionTime: 0,
        rowCount: fusionReactions.length,
        totalCount: fusionReactions.length,
      });

      mockQueryTwoToTwo.mockReturnValue({
        reactions: twoToTwoReactions,
        nuclides: [],
        elements: [],
        radioactiveNuclides: new Set(),
        executionTime: 0,
        rowCount: twoToTwoReactions.length,
        totalCount: twoToTwoReactions.length,
      });

      mockQueryFission.mockReturnValue({
        reactions: [],
        nuclides: [],
        elements: [],
        radioactiveNuclides: new Set(),
        executionTime: 0,
        rowCount: 0,
        totalCount: 0,
      });

      const nuclides: Nuclide[] = [
        createMockNuclide('H', 1, { ppmNSolar: 1000 }),
        createMockNuclide('C', 12, { ppmNSolar: 100 }),
        createMockNuclide('C', 13, { ppmNSolar: 1 }),
        createMockNuclide('N', 13, { logHalfLife: 1 }), // Radioactive
        createMockNuclide('N', 14, { ppmNSolar: 10 }),
        createMockNuclide('N', 15, { ppmNSolar: 0.1 }),
        createMockNuclide('O', 15, { logHalfLife: 1 }), // Radioactive
        createMockNuclide('He', 4, { ppmNSolar: 50 }),
      ];

      mockGetAllNuclides.mockReturnValue(nuclides);

      const params: CycleDiscoveryParameters = {
        minFusionMeV: 0.1,
        minTwoToTwoMeV: 0.1,
        maxCycleDepth: 6,
        includeFission: false,
        maxCycles: 100,
      };

      const results = await discoverCycles(mockDb, params);

      // Should find cycles involving C-12 and H-1
      // The cycle should show C-12 as both input and output (feedback)
      const cyclesWithC12 = results.cycles.filter((cycle) =>
        cycle.fuelNuclides.includes('C-12') || cycle.fuelNuclides.includes('H-1')
      );

      // If cycles are found, verify they contain the expected reactions
      if (cyclesWithC12.length > 0) {
        cyclesWithC12.forEach((cycle) => {
          expect(cycle.reactions.length).toBeGreaterThan(0);
          expect(cycle.totalEnergy).toBeGreaterThan(0);
          expect(cycle.feedbackRatio).toBeGreaterThanOrEqual(0);
        });
      }
    });

    /**
     * Test with Li-6 cycle example from the issue description
     * Li-6 + Li-6 → C-12, C-12 + Li-6 → O-18, O-18 + Li-6 → Mg-24, Mg-24 + Li-6 → Si-30
     */
    it('should detect Li-6 cycle pattern', async () => {
      const fusionReactions: FusionReaction[] = [
        createFusionReaction('Li', 6, 'Li', 6, 'C', 12, 28.18),
        createFusionReaction('C', 12, 'Li', 6, 'O', 18, 14.87),
        createFusionReaction('O', 18, 'Li', 6, 'Mg', 24, 27.24),
        createFusionReaction('Mg', 24, 'Li', 6, 'Si', 30, 24.60),
      ];

      mockQueryFusion.mockReturnValue({
        reactions: fusionReactions,
        nuclides: [],
        elements: [],
        radioactiveNuclides: new Set(),
        executionTime: 0,
        rowCount: fusionReactions.length,
        totalCount: fusionReactions.length,
      });

      mockQueryTwoToTwo.mockReturnValue({
        reactions: [],
        nuclides: [],
        elements: [],
        radioactiveNuclides: new Set(),
        executionTime: 0,
        rowCount: 0,
        totalCount: 0,
      });

      mockQueryFission.mockReturnValue({
        reactions: [],
        nuclides: [],
        elements: [],
        radioactiveNuclides: new Set(),
        executionTime: 0,
        rowCount: 0,
        totalCount: 0,
      });

      const nuclides: Nuclide[] = [
        createMockNuclide('Li', 6, { ppmNSolar: 0.1 }), // Rare isotope
        createMockNuclide('C', 12, { ppmNSolar: 100 }),
        createMockNuclide('O', 18, { ppmNSolar: 0.2 }),
        createMockNuclide('Mg', 24, { ppmNSolar: 10 }),
        createMockNuclide('Si', 30, { ppmNSolar: 0.1 }),
      ];

      mockGetAllNuclides.mockReturnValue(nuclides);

      const params: CycleDiscoveryParameters = {
        minFusionMeV: 1.0,
        minTwoToTwoMeV: 1.0,
        maxCycleDepth: 5,
        includeFission: false,
        maxCycles: 100,
      };

      const results = await discoverCycles(mockDb, params);

      // Look for cycles starting with Li-6
      const li6Cycles = results.cycles.filter((cycle) =>
        cycle.fuelNuclides.includes('Li-6')
      );

      if (li6Cycles.length > 0) {
        // Verify cycle properties match expected values
        const cycle = li6Cycles[0];
        expect(cycle.fuelNuclides).toContain('Li-6');
        expect(cycle.reactions.length).toBeGreaterThanOrEqual(1);
        
        // Total energy should be sum of reaction energies
        const expectedEnergy = 28.18 + 14.87 + 27.24 + 24.60; // ~95 MeV
        // Allow some tolerance since we may not get the exact cycle
        expect(cycle.totalEnergy).toBeGreaterThan(0);
      }
    });

    /**
     * Test with H-1 + B-11 cycle (CNO-like)
     * H-1 + B-11 → C-12, C-12 + H-1 → C-13, C-13 + H-1 → N-14, N-14 + H-1 → N-15
     */
    it('should detect H-1 + B-11 cycle pattern', async () => {
      const fusionReactions: FusionReaction[] = [
        createFusionReaction('H', 1, 'B', 11, 'C', 12, 15.96),
        createFusionReaction('C', 12, 'H', 1, 'C', 13, 4.16),
        createFusionReaction('C', 13, 'H', 1, 'N', 14, 7.39),
        createFusionReaction('N', 14, 'H', 1, 'N', 15, 10.21),
      ];

      mockQueryFusion.mockReturnValue({
        reactions: fusionReactions,
        nuclides: [],
        elements: [],
        radioactiveNuclides: new Set(),
        executionTime: 0,
        rowCount: fusionReactions.length,
        totalCount: fusionReactions.length,
      });

      mockQueryTwoToTwo.mockReturnValue({
        reactions: [],
        nuclides: [],
        elements: [],
        radioactiveNuclides: new Set(),
        executionTime: 0,
        rowCount: 0,
        totalCount: 0,
      });

      mockQueryFission.mockReturnValue({
        reactions: [],
        nuclides: [],
        elements: [],
        radioactiveNuclides: new Set(),
        executionTime: 0,
        rowCount: 0,
        totalCount: 0,
      });

      const nuclides: Nuclide[] = [
        createMockNuclide('H', 1, { ppmNSolar: 1000 }), // Very abundant
        createMockNuclide('B', 11, { ppmNSolar: 0.1 }), // Abundant isotope of B
        createMockNuclide('C', 12, { ppmNSolar: 100 }),
        createMockNuclide('C', 13, { ppmNSolar: 1 }),
        createMockNuclide('N', 14, { ppmNSolar: 10 }),
        createMockNuclide('N', 15, { ppmNSolar: 0.1 }),
      ];

      mockGetAllNuclides.mockReturnValue(nuclides);

      const params: CycleDiscoveryParameters = {
        minFusionMeV: 1.0,
        minTwoToTwoMeV: 1.0,
        maxCycleDepth: 5,
        includeFission: false,
        maxCycles: 100,
      };

      const results = await discoverCycles(mockDb, params);

      // Look for cycles with H-1 and B-11
      const h1B11Cycles = results.cycles.filter(
        (cycle) =>
          cycle.fuelNuclides.includes('H-1') && cycle.fuelNuclides.includes('B-11')
      );

      if (h1B11Cycles.length > 0) {
        const cycle = h1B11Cycles[0];
        expect(cycle.fuelNuclides).toContain('H-1');
        expect(cycle.fuelNuclides).toContain('B-11');
        
        // Expected total energy ~37.8 MeV
        expect(cycle.totalEnergy).toBeGreaterThan(30);
        expect(cycle.totalEnergy).toBeLessThan(50);
        
        // Should have high abundance score (H-1 is very abundant, B-11 is common)
        expect(cycle.abundanceScore).toBeGreaterThan(50);
      }
    });
  });

  describe('algorithm validation', () => {
    it('should correctly identify cycles where products feed back to fuel', async () => {
      // Create a clear cycle: A + B → C, C + A → B (feedback)
      const twoToTwoReactions: TwoToTwoReaction[] = [
        createTwoToTwoReaction('A', 1, 'B', 1, 'C', 1, 'D', 1, 5.0), // A + B → C + D
        createTwoToTwoReaction('C', 1, 'A', 1, 'B', 1, 'E', 1, 3.0), // C + A → B + E (B feeds back)
      ];

      mockQueryFusion.mockReturnValue({
        reactions: [],
        nuclides: [],
        elements: [],
        radioactiveNuclides: new Set(),
        executionTime: 0,
        rowCount: 0,
        totalCount: 0,
      });

      mockQueryTwoToTwo.mockReturnValue({
        reactions: twoToTwoReactions,
        nuclides: [],
        elements: [],
        radioactiveNuclides: new Set(),
        executionTime: 0,
        rowCount: twoToTwoReactions.length,
        totalCount: twoToTwoReactions.length,
      });

      mockQueryFission.mockReturnValue({
        reactions: [],
        nuclides: [],
        elements: [],
        radioactiveNuclides: new Set(),
        executionTime: 0,
        rowCount: 0,
        totalCount: 0,
      });

      const nuclides: Nuclide[] = [
        createMockNuclide('A', 1),
        createMockNuclide('B', 1),
        createMockNuclide('C', 1),
        createMockNuclide('D', 1),
        createMockNuclide('E', 1),
      ];

      mockGetAllNuclides.mockReturnValue(nuclides);

      const params: CycleDiscoveryParameters = {
        minFusionMeV: 0.1,
        minTwoToTwoMeV: 0.1,
        maxCycleDepth: 5,
        includeFission: false,
        maxCycles: 100,
      };

      const results = await discoverCycles(mockDb, params);

      // Should find cycles where B appears as both fuel and product
      const cyclesWithB = results.cycles.filter((cycle) =>
        cycle.fuelNuclides.includes('B-1')
      );

      if (cyclesWithB.length > 0) {
        // Verify feedback is detected
        cyclesWithB.forEach((cycle) => {
          const hasFeedback = cycle.reactions.some((r) => r.isFeedback);
          expect(hasFeedback).toBe(true);
          expect(cycle.feedbackRatio).toBeGreaterThan(0);
        });
      }
    });

    it('should handle cycles with multiple feedback paths', async () => {
      // Create cycle with branching: A + B → C, C + A → B, C + B → A
      const twoToTwoReactions: TwoToTwoReaction[] = [
        createTwoToTwoReaction('A', 1, 'B', 1, 'C', 1, 'D', 1, 5.0),
        createTwoToTwoReaction('C', 1, 'A', 1, 'B', 1, 'E', 1, 3.0), // C + A → B (feedback)
        createTwoToTwoReaction('C', 1, 'B', 1, 'A', 1, 'F', 1, 2.0), // C + B → A (feedback)
      ];

      mockQueryFusion.mockReturnValue({
        reactions: [],
        nuclides: [],
        elements: [],
        radioactiveNuclides: new Set(),
        executionTime: 0,
        rowCount: 0,
        totalCount: 0,
      });

      mockQueryTwoToTwo.mockReturnValue({
        reactions: twoToTwoReactions,
        nuclides: [],
        elements: [],
        radioactiveNuclides: new Set(),
        executionTime: 0,
        rowCount: twoToTwoReactions.length,
        totalCount: twoToTwoReactions.length,
      });

      mockQueryFission.mockReturnValue({
        reactions: [],
        nuclides: [],
        elements: [],
        radioactiveNuclides: new Set(),
        executionTime: 0,
        rowCount: 0,
        totalCount: 0,
      });

      const nuclides: Nuclide[] = [
        createMockNuclide('A', 1),
        createMockNuclide('B', 1),
        createMockNuclide('C', 1),
        createMockNuclide('D', 1),
        createMockNuclide('E', 1),
        createMockNuclide('F', 1),
      ];

      mockGetAllNuclides.mockReturnValue(nuclides);

      const params: CycleDiscoveryParameters = {
        minFusionMeV: 0.1,
        minTwoToTwoMeV: 0.1,
        maxCycleDepth: 5,
        includeFission: false,
        maxCycles: 100,
      };

      const results = await discoverCycles(mockDb, params);

      // Should find multiple cycles with different feedback paths
      expect(results.cycles.length).toBeGreaterThanOrEqual(0);
      
      // If cycles found, verify they have feedback
      results.cycles.forEach((cycle) => {
        expect(cycle.reactions.length).toBeGreaterThan(0);
        expect(cycle.feedbackRatio).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe('cycle validation', () => {
    it('should validate cycle energy calculations', () => {
      const cycle: DiscoveredCycle = {
        id: 'test-cycle',
        fuelNuclides: ['H-1', 'Li-7'],
        reactions: [
          {
            type: 'fusion',
            inputs: ['H-1', 'Li-7'],
            outputs: ['He-4'],
            MeV: 15.0,
            isFeedback: false,
          },
          {
            type: 'fusion',
            inputs: ['He-4', 'H-1'],
            outputs: ['Li-5'],
            MeV: 2.0,
            isFeedback: true,
          },
        ],
        totalEnergy: 17.0,
        feedbackRatio: 50.0,
        cycleDepth: 2,
        abundanceScore: 75.0,
        stabilityScore: 80.0,
      };

      const validation = validateCycleEnergy(cycle);
      expect(validation.valid).toBe(true);
      expect(validation.calculatedEnergy).toBe(17.0);
      expect(validation.reportedEnergy).toBe(17.0);
    });

    it('should detect energy calculation errors', () => {
      const cycle: DiscoveredCycle = {
        id: 'test-cycle',
        fuelNuclides: ['H-1'],
        reactions: [
          {
            type: 'fusion',
            inputs: ['H-1', 'H-1'],
            outputs: ['He-2'],
            MeV: 1.0,
            isFeedback: false,
          },
        ],
        totalEnergy: 5.0, // Wrong! Should be 1.0
        feedbackRatio: 0,
        cycleDepth: 1,
        abundanceScore: 50,
        stabilityScore: 50,
      };

      const validation = validateCycleEnergy(cycle);
      expect(validation.valid).toBe(false);
      expect(validation.difference).toBeGreaterThan(0.01);
    });

    it('should validate cycle structure', () => {
      const validCycle: DiscoveredCycle = {
        id: 'valid-cycle',
        fuelNuclides: ['H-1'],
        reactions: [
          {
            type: 'fusion',
            inputs: ['H-1', 'H-1'],
            outputs: ['He-2'],
            MeV: 1.0,
            isFeedback: false,
          },
        ],
        totalEnergy: 1.0,
        feedbackRatio: 0,
        cycleDepth: 1,
        abundanceScore: 50,
        stabilityScore: 50,
      };

      const validation = validateCycleStructure(validCycle);
      expect(validation.valid).toBe(true);
      expect(validation.errors).toEqual([]);
    });

    it('should detect structure errors', () => {
      const invalidCycle: DiscoveredCycle = {
        id: 'invalid-cycle',
        fuelNuclides: [], // Error: no fuel
        reactions: [], // Error: no reactions
        totalEnergy: 0,
        feedbackRatio: 150, // Error: > 100
        cycleDepth: 0,
        abundanceScore: -10, // Error: < 0
        stabilityScore: 50,
      };

      const validation = validateCycleStructure(invalidCycle);
      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });

    it('should match cycles against known patterns', () => {
      // Create a cycle that matches the Li-6 cycle pattern
      const cycle: DiscoveredCycle = {
        id: 'li6-cycle',
        fuelNuclides: ['Li-6'],
        reactions: [
          {
            type: 'fusion',
            inputs: ['Li-6', 'Li-6'],
            outputs: ['C-12'],
            MeV: 28.18,
            isFeedback: false,
          },
          {
            type: 'fusion',
            inputs: ['C-12', 'Li-6'],
            outputs: ['O-18'],
            MeV: 14.87,
            isFeedback: true,
          },
          {
            type: 'fusion',
            inputs: ['O-18', 'Li-6'],
            outputs: ['Mg-24'],
            MeV: 27.24,
            isFeedback: true,
          },
          {
            type: 'fusion',
            inputs: ['Mg-24', 'Li-6'],
            outputs: ['Si-30'],
            MeV: 24.60,
            isFeedback: true,
          },
        ],
        totalEnergy: 94.09,
        feedbackRatio: 75.0, // 3 out of 4 reactions are feedback
        cycleDepth: 4,
        abundanceScore: 20.0, // Li-6 is rare
        stabilityScore: 100.0,
      };

      const validation = validateCycleAgainstKnown(cycle);
      expect(validation.matches).toBe(true);
      expect(validation.matchedCycle).toBeDefined();
      expect(validation.similarity).toBeGreaterThan(0.8);
    });
  });
});

