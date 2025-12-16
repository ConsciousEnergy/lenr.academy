/**
 * Cycle Results Table Component
 *
 * Displays discovered cycles in a sortable table with metrics and actions.
 */

import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowUpDown, Eye, Play, ArrowUp, ArrowDown } from 'lucide-react';
import type { DiscoveredCycle } from '../types';

interface CycleResultsTableProps {
  cycles: DiscoveredCycle[];
  onViewCycle?: (cycle: DiscoveredCycle) => void;
  onRunSimulation?: (cycle: DiscoveredCycle) => void;
}

type SortField = 'fuel' | 'depth' | 'energy' | 'feedback' | 'abundance' | 'stability';
type SortDirection = 'asc' | 'desc';

export default function CycleResultsTable({
  cycles,
  onViewCycle,
  onRunSimulation,
}: CycleResultsTableProps) {
  const { t } = useTranslation();
  const [sortField, setSortField] = useState<SortField>('energy');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const sortedCycles = useMemo(() => {
    const sorted = [...cycles].sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case 'fuel':
          comparison = a.fuelNuclides.join(', ').localeCompare(b.fuelNuclides.join(', '));
          break;
        case 'depth':
          comparison = a.cycleDepth - b.cycleDepth;
          break;
        case 'energy':
          comparison = a.totalEnergy - b.totalEnergy;
          break;
        case 'feedback':
          comparison = a.feedbackRatio - b.feedbackRatio;
          break;
        case 'abundance':
          comparison = a.abundanceScore - b.abundanceScore;
          break;
        case 'stability':
          comparison = a.stabilityScore - b.stabilityScore;
          break;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return sorted;
  }, [cycles, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const SortButton = ({ field, children }: { field: SortField; children: React.ReactNode }) => {
    const isActive = sortField === field;
    return (
      <button
        onClick={() => handleSort(field)}
        className="flex items-center gap-1 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
      >
        {children}
        {isActive ? (
          sortDirection === 'asc' ? (
            <ArrowUp className="w-3 h-3" />
          ) : (
            <ArrowDown className="w-3 h-3" />
          )
        ) : (
          <ArrowUpDown className="w-3 h-3 opacity-50" />
        )}
      </button>
    );
  };

  if (cycles.length === 0) {
    return (
      <div className="card p-6 text-center text-gray-500 dark:text-gray-400">
        {t('cascades.cycleDiscovery.noCyclesFound', 'No cycles found. Try adjusting your search parameters.')}
      </div>
    );
  }

  return (
    <div className="card p-6">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          {t('cascades.cycleDiscovery.results', 'Discovered Cycles')} ({cycles.length})
        </h3>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                <SortButton field="fuel">
                  {t('cascades.cycleDiscovery.fuel', 'Fuel Nuclides')}
                </SortButton>
              </th>
              <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                <SortButton field="depth">
                  {t('cascades.cycleDiscovery.depth', 'Depth')}
                </SortButton>
              </th>
              <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                <SortButton field="energy">
                  {t('cascades.cycleDiscovery.totalEnergy', 'Total Energy (MeV)')}
                </SortButton>
              </th>
              <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                <SortButton field="feedback">
                  {t('cascades.cycleDiscovery.feedbackRatio', 'Feedback Ratio (%)')}
                </SortButton>
              </th>
              <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                <SortButton field="abundance">
                  {t('cascades.cycleDiscovery.abundanceScore', 'Abundance Score')}
                </SortButton>
              </th>
              <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                <SortButton field="stability">
                  {t('cascades.cycleDiscovery.stabilityScore', 'Stability Score')}
                </SortButton>
              </th>
              <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                {t('cascades.cycleDiscovery.actions', 'Actions')}
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedCycles.map((cycle) => (
              <tr
                key={cycle.id}
                className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
              >
                <td className="py-3 px-4 text-sm text-gray-900 dark:text-white">
                  <div className="flex flex-wrap gap-1">
                    {cycle.fuelNuclides.map((nuclide) => (
                      <span
                        key={nuclide}
                        className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 rounded text-xs font-medium"
                      >
                        {nuclide}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="py-3 px-4 text-sm text-gray-700 dark:text-gray-300">
                  {cycle.cycleDepth}
                </td>
                <td className="py-3 px-4 text-sm text-gray-700 dark:text-gray-300 font-medium">
                  {cycle.totalEnergy.toFixed(2)}
                </td>
                <td className="py-3 px-4 text-sm text-gray-700 dark:text-gray-300">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className="bg-primary-600 h-2 rounded-full"
                        style={{ width: `${cycle.feedbackRatio}%` }}
                      />
                    </div>
                    <span className="text-xs w-12 text-right">{cycle.feedbackRatio.toFixed(1)}%</span>
                  </div>
                </td>
                <td className="py-3 px-4 text-sm text-gray-700 dark:text-gray-300">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className="bg-green-600 h-2 rounded-full"
                        style={{ width: `${cycle.abundanceScore}%` }}
                      />
                    </div>
                    <span className="text-xs w-12 text-right">{cycle.abundanceScore.toFixed(1)}</span>
                  </div>
                </td>
                <td className="py-3 px-4 text-sm text-gray-700 dark:text-gray-300">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className="bg-purple-600 h-2 rounded-full"
                        style={{ width: `${cycle.stabilityScore}%` }}
                      />
                    </div>
                    <span className="text-xs w-12 text-right">{cycle.stabilityScore.toFixed(1)}</span>
                  </div>
                </td>
                <td className="py-3 px-4 text-sm">
                  <div className="flex items-center gap-2">
                    {onViewCycle && (
                      <button
                        onClick={() => onViewCycle(cycle)}
                        className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded transition-colors"
                        title={t('cascades.cycleDiscovery.viewCycle', 'View Cycle')}
                      >
                        <Eye className="w-3 h-3" />
                        {t('cascades.cycleDiscovery.view', 'View')}
                      </button>
                    )}
                    {onRunSimulation && (
                      <button
                        onClick={() => onRunSimulation(cycle)}
                        className="flex items-center gap-1 px-2 py-1 text-xs bg-primary-600 hover:bg-primary-700 text-white rounded transition-colors"
                        title={t('cascades.cycleDiscovery.runSimulation', 'Run Cascade Simulation')}
                      >
                        <Play className="w-3 h-3" />
                        {t('cascades.cycleDiscovery.simulate', 'Simulate')}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}



