/**
 * Cycle Discovery Search Component
 *
 * Provides search interface for discovering feedback cycles in the reaction database.
 * Includes filters for energy thresholds, cycle depth, fission inclusion, and element constraints.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Filter } from 'lucide-react';
import type { CycleDiscoveryParameters } from '../types';

interface CycleDiscoverySearchProps {
  params: CycleDiscoveryParameters;
  onParamsChange: (params: CycleDiscoveryParameters) => void;
  onSearch: () => void;
  isSearching?: boolean;
}

export default function CycleDiscoverySearch({
  params,
  onParamsChange,
  onSearch,
  isSearching = false,
}: CycleDiscoverySearchProps) {
  const { t } = useTranslation();
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  const updateParam = <K extends keyof CycleDiscoveryParameters>(
    key: K,
    value: CycleDiscoveryParameters[K]
  ) => {
    onParamsChange({
      ...params,
      [key]: value,
    });
  };

  const updateElementFilter = <K extends keyof NonNullable<CycleDiscoveryParameters['elementFilters']>>(
    key: K,
    value: NonNullable<CycleDiscoveryParameters['elementFilters']>[K]
  ) => {
    onParamsChange({
      ...params,
      elementFilters: {
        ...params.elementFilters,
        [key]: value,
      },
    });
  };

  return (
    <div className="card p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          {t('cascades.cycleDiscovery.title', 'Cycle Discovery')}
        </h2>
        <button
          onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
          className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
        >
          <Filter className="w-4 h-4" />
          {showAdvancedFilters
            ? t('cascades.cycleDiscovery.hideFilters', 'Hide Filters')
            : t('cascades.cycleDiscovery.showFilters', 'Show Filters')}
        </button>
      </div>

      <p className="text-sm text-gray-600 dark:text-gray-400">
        {t(
          'cascades.cycleDiscovery.description',
          'Search for fuel combinations that form closed-loop reaction cycles (feedback loops).'
        )}
      </p>

      {/* Basic Parameters */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Energy Thresholds */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            {t('cascades.cycleDiscovery.minFusionMeV', 'Min Fusion Energy (MeV)')}
          </label>
          <input
            type="number"
            min="0"
            step="0.1"
            value={params.minFusionMeV}
            onChange={(e) => updateParam('minFusionMeV', parseFloat(e.target.value) || 0)}
            className="input w-full"
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            {t('cascades.cycleDiscovery.minTwoToTwoMeV', 'Min Two-to-Two Energy (MeV)')}
          </label>
          <input
            type="number"
            min="0"
            step="0.1"
            value={params.minTwoToTwoMeV}
            onChange={(e) => updateParam('minTwoToTwoMeV', parseFloat(e.target.value) || 0)}
            className="input w-full"
          />
        </div>

        {params.includeFission && (
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('cascades.cycleDiscovery.minFissionMeV', 'Min Fission Energy (MeV)')}
            </label>
            <input
              type="number"
              min="0"
              step="0.1"
              value={params.minFissionMeV || params.minFusionMeV}
              onChange={(e) => updateParam('minFissionMeV', parseFloat(e.target.value) || 0)}
              className="input w-full"
            />
          </div>
        )}

        {/* Cycle Depth */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            {t('cascades.cycleDiscovery.maxCycleDepth', 'Max Cycle Depth')}: {params.maxCycleDepth}
          </label>
          <input
            type="range"
            min="3"
            max="10"
            value={params.maxCycleDepth}
            onChange={(e) => updateParam('maxCycleDepth', parseInt(e.target.value, 10))}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>3</span>
            <span>10</span>
          </div>
        </div>

        {/* Max Cycles */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            {t('cascades.cycleDiscovery.maxCycles', 'Max Cycles to Display')}
          </label>
          <input
            type="number"
            min="10"
            max="1000"
            step="10"
            value={params.maxCycles}
            onChange={(e) => updateParam('maxCycles', parseInt(e.target.value, 10) || 100)}
            className="input w-full"
          />
        </div>
      </div>

      {/* Include Fission Toggle */}
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 cursor-pointer">
          <div className="relative">
            <input
              type="checkbox"
              checked={params.includeFission}
              onChange={(e) => updateParam('includeFission', e.target.checked)}
              className="sr-only"
            />
            <div
              className={`w-10 h-6 rounded-full transition-colors ${
                params.includeFission ? 'bg-primary-600' : 'bg-gray-300 dark:bg-gray-600'
              }`}
            >
              <div
                className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${
                  params.includeFission ? 'translate-x-4' : ''
                }`}
              />
            </div>
          </div>
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {t('cascades.cycleDiscovery.includeFission', 'Include Fission Reactions')}
          </span>
        </label>
      </div>

      {/* Advanced Filters */}
      {showAdvancedFilters && (
        <div className="border-t border-gray-200 dark:border-gray-700 pt-4 space-y-4">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            {t('cascades.cycleDiscovery.advancedFilters', 'Advanced Filters')}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Abundant Only */}
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={params.elementFilters?.abundantOnly || false}
                  onChange={(e) =>
                    updateElementFilter('abundantOnly', e.target.checked || undefined)
                  }
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  {t('cascades.cycleDiscovery.abundantOnly', 'Abundant Elements Only')}
                </span>
              </label>
            </div>

            {/* Exclude Radioactive */}
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={params.elementFilters?.excludeRadioactive || false}
                  onChange={(e) =>
                    updateElementFilter('excludeRadioactive', e.target.checked || undefined)
                  }
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  {t('cascades.cycleDiscovery.excludeRadioactive', 'Exclude Radioactive')}
                </span>
              </label>
            </div>
          </div>

          {/* Allowed Elements (simple text input for now) */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('cascades.cycleDiscovery.allowedElements', 'Allowed Elements (comma-separated)')}
            </label>
            <input
              type="text"
              placeholder="H, Li, B, C, N, O, ..."
              value={params.elementFilters?.allowedElements?.join(', ') || ''}
              onChange={(e) => {
                const elements = e.target.value
                  .split(',')
                  .map((s) => s.trim())
                  .filter((s) => s.length > 0);
                updateElementFilter('allowedElements', elements.length > 0 ? elements : undefined);
              }}
              className="input w-full"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {t(
                'cascades.cycleDiscovery.allowedElementsHint',
                'Leave empty to allow all elements. Example: H, Li, B, C, N, O'
              )}
            </p>
          </div>
        </div>
      )}

      {/* Search Button */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={onSearch}
          disabled={isSearching}
          className="flex items-center gap-2 px-6 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
        >
          <Search className="w-4 h-4" />
          {isSearching
            ? t('cascades.cycleDiscovery.searching', 'Searching...')
            : t('cascades.cycleDiscovery.search', 'Search for Cycles')}
        </button>
      </div>
    </div>
  );
}


