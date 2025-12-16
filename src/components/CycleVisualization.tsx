/**
 * Cycle Visualization Component
 *
 * Visualizes a single discovered cycle using a list view with detailed reactions.
 */

import { useTranslation } from 'react-i18next';
import { Play, Info } from 'lucide-react';
import type { DiscoveredCycle } from '../types';

interface CycleVisualizationProps {
  cycle: DiscoveredCycle;
  onRunSimulation?: () => void;
}

export default function CycleVisualization({ cycle, onRunSimulation }: CycleVisualizationProps) {
  const { t } = useTranslation();

  return (
    <div className="card p-6 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            {t('cascades.cycleDiscovery.cycleDetails', 'Cycle Details')}
          </h3>
          <div className="flex flex-wrap gap-2 mb-2">
            {cycle.fuelNuclides.map((nuclide) => (
              <span
                key={nuclide}
                className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 rounded text-sm font-medium"
              >
                {nuclide}
              </span>
            ))}
          </div>
        </div>
        {onRunSimulation && (
          <button
            onClick={onRunSimulation}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
          >
            <Play className="w-4 h-4" />
            {t('cascades.cycleDiscovery.runFullCascade', 'Run Full Cascade')}
          </button>
        )}
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gray-50 dark:bg-gray-800/50 p-3 rounded-lg">
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
            {t('cascades.cycleDiscovery.totalEnergy', 'Total Energy')}
          </div>
          <div className="text-lg font-semibold text-gray-900 dark:text-white">
            {cycle.totalEnergy.toFixed(2)} MeV
          </div>
        </div>
        <div className="bg-gray-50 dark:bg-gray-800/50 p-3 rounded-lg">
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
            {t('cascades.cycleDiscovery.feedbackRatio', 'Feedback Ratio')}
          </div>
          <div className="text-lg font-semibold text-gray-900 dark:text-white">
            {cycle.feedbackRatio.toFixed(1)}%
          </div>
        </div>
        <div className="bg-gray-50 dark:bg-gray-800/50 p-3 rounded-lg">
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
            {t('cascades.cycleDiscovery.abundanceScore', 'Abundance Score')}
          </div>
          <div className="text-lg font-semibold text-gray-900 dark:text-white">
            {cycle.abundanceScore.toFixed(1)}
          </div>
        </div>
        <div className="bg-gray-50 dark:bg-gray-800/50 p-3 rounded-lg">
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
            {t('cascades.cycleDiscovery.stabilityScore', 'Stability Score')}
          </div>
          <div className="text-lg font-semibold text-gray-900 dark:text-white">
            {cycle.stabilityScore.toFixed(1)}
          </div>
        </div>
      </div>

      {/* Reactions List */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
          {t('cascades.cycleDiscovery.reactions', 'Reactions')} ({cycle.reactions.length})
        </h4>
        <div className="space-y-2">
          {cycle.reactions.map((reaction, index) => (
            <div
              key={index}
              className={`p-3 rounded-lg border ${
                reaction.isFeedback
                  ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
                  : 'bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                      {index + 1}.
                    </span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded ${
                        reaction.type === 'fusion'
                          ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200'
                          : reaction.type === 'twotwo'
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200'
                          : 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200'
                      }`}
                    >
                      {reaction.type.toUpperCase()}
                    </span>
                    {reaction.isFeedback && (
                      <span className="text-xs px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 rounded">
                        {t('cascades.cycleDiscovery.feedback', 'Feedback')}
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-gray-900 dark:text-white">
                    <span className="font-medium">
                      {reaction.inputs.map((input, i) => (
                        <span key={input}>
                          {input}
                          {i < reaction.inputs.length - 1 && ' + '}
                        </span>
                      ))}
                    </span>
                    <span className="mx-2">→</span>
                    <span className="font-medium">
                      {reaction.outputs.map((output, i) => (
                        <span key={output}>
                          {output}
                          {i < reaction.outputs.length - 1 && ' + '}
                        </span>
                      ))}
                    </span>
                  </div>
                </div>
                <div className="text-sm font-semibold text-gray-700 dark:text-gray-300 ml-4">
                  {reaction.MeV.toFixed(2)} MeV
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Cycle Flow Diagram (List View) */}
      <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
        <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
          {t('cascades.cycleDiscovery.cycleFlow', 'Cycle Flow')}
        </h4>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {cycle.fuelNuclides.map((nuclide, i) => (
            <span key={nuclide}>
              <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 rounded font-medium">
                {nuclide}
              </span>
              {i < cycle.fuelNuclides.length - 1 && <span className="mx-1">+</span>}
            </span>
          ))}
          {cycle.reactions.map((reaction, index) => (
            <span key={index} className="flex items-center gap-2">
              <span className="text-gray-400">→</span>
              {reaction.outputs.map((output, i) => (
                <span key={output}>
                  <span
                    className={`px-2 py-1 rounded font-medium ${
                      cycle.fuelNuclides.includes(output)
                        ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
                    }`}
                  >
                    {output}
                  </span>
                  {i < reaction.outputs.length - 1 && <span className="mx-1">+</span>}
                </span>
              ))}
              {index < cycle.reactions.length - 1 && (
                <span className="text-gray-400 mx-1">
                  {reaction.outputs.some((output) => cycle.fuelNuclides.includes(output))
                    ? '↻'
                    : '→'}
                </span>
              )}
            </span>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
          <Info className="w-3 h-3" />
          <span>
            {t(
              'cascades.cycleDiscovery.flowHint',
              'Yellow highlights indicate feedback (products that react with fuel)'
            )}
          </span>
        </div>
      </div>
    </div>
  );
}
