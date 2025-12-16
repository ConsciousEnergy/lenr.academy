import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Play, Settings, AlertCircle, CheckCircle, XCircle, Loader2, Download, Scale, BookOpen } from 'lucide-react'
import { useDatabase } from '../contexts/DatabaseContext'
import { useQueryState } from '../contexts/QueryStateContext'
import { useCascadeWorker } from '../hooks/useCascadeWorker'
import CascadeProgressCard from '../components/CascadeProgressCard'
import CascadeTabs from '../components/CascadeTabs'
import PeriodicTableSelector from '../components/PeriodicTableSelector'
import ProportionInput from '../components/ProportionInput'
import MaterialsCatalog from '../components/MaterialsCatalog'
import { getAllElements } from '../services/queryService'
import { createEqualProportions } from '../services/proportionService'
import { discoverCycles } from '../services/cycleDiscoveryService'
import type {
  CascadeResults,
  Element,
  WeightedNuclide,
  ProportionFormat,
  CycleDiscoveryParameters,
  CycleDiscoveryResults,
  DiscoveredCycle,
} from '../types'

export default function CascadesAll() {
  const { t } = useTranslation()
  const { db } = useDatabase()
  const { getCascadeState, updateCascadeState } = useQueryState()
  const { runCascade, cancelCascade, progress, isRunning, error: workerError } = useCascadeWorker()
  const [hasRestoredFromContext, setHasRestoredFromContext] = useState(false)

  const [params, setParams] = useState({
    temperature: 2400,
    minFusionMeV: 1.0,
    minTwoToTwoMeV: 1.0,
    maxNuclides: 5000,
    maxLoops: 25,
    feedbackBosons: true,
    feedbackFermions: true,
    allowDimers: true,
    excludeMelted: false,
    excludeBoiledOff: true,
  })

  // Local state for sliders during dragging (prevents performance issues)
  const [sliderMaxNuclides, setSliderMaxNuclides] = useState(5000)
  const [sliderMaxLoops, setSliderMaxLoops] = useState(25)

  const [availableElements, setAvailableElements] = useState<Element[]>([])
  const [fuelNuclides, setFuelNuclides] = useState<string[]>(['H-1', 'Li-7', 'Al-27', 'N-14', 'Ni-58', 'Ni-60', 'Ni-62', 'B-10', 'B-11'])
  const [results, setResults] = useState<CascadeResults | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Weighted mode state (Issue #96)
  const [useWeightedMode, setUseWeightedMode] = useState(false)
  const [weightedFuel, setWeightedFuel] = useState<WeightedNuclide[]>([])
  const [proportionFormat, setProportionFormat] = useState<ProportionFormat>('percentage')
  const [showMaterialsCatalog, setShowMaterialsCatalog] = useState(false)

  // Cycle discovery state (Issue #92)
  const [cycleDiscoveryParams, setCycleDiscoveryParams] = useState<CycleDiscoveryParameters>({
    minFusionMeV: 1.0,
    minTwoToTwoMeV: 1.0,
    minFissionMeV: 1.0,
    maxCycleDepth: 5,
    includeFission: true,
    maxCycles: 100,
  })
  const [cycleDiscoveryResults, setCycleDiscoveryResults] = useState<CycleDiscoveryResults | null>(null)
  const [selectedCycle, setSelectedCycle] = useState<DiscoveredCycle | null>(null)
  const [isCycleSearching, setIsCycleSearching] = useState(false)
  const [activeResultsTab, setActiveResultsTab] = useState<'summary' | 'flow' | 'pathways' | 'network' | 'products'>('summary')

  // Load available elements and restore state when database is ready
  useEffect(() => {
    if (db) {
      const elements = getAllElements(db)
      setAvailableElements(elements)

      // Restore state from context if not already done
      if (!hasRestoredFromContext) {
        const savedState = getCascadeState()
        if (savedState) {
          setParams({
            temperature: savedState.temperature,
            minFusionMeV: savedState.minFusionMeV,
            minTwoToTwoMeV: savedState.minTwoToTwoMeV,
            maxNuclides: savedState.maxNuclides,
            maxLoops: savedState.maxLoops,
            feedbackBosons: savedState.feedbackBosons,
            feedbackFermions: savedState.feedbackFermions,
            allowDimers: savedState.allowDimers,
            excludeMelted: savedState.excludeMelted,
            excludeBoiledOff: savedState.excludeBoiledOff,
          })
          setSliderMaxNuclides(savedState.maxNuclides)
          setSliderMaxLoops(savedState.maxLoops)
          setFuelNuclides(savedState.fuelNuclides)

          // Restore weighted mode state (Issue #96)
          if (savedState.weightedFuel) {
            setWeightedFuel(savedState.weightedFuel)
          }
          if (savedState.proportionFormat) {
            setProportionFormat(savedState.proportionFormat)
          }
          if (savedState.useWeightedMode !== undefined) {
            setUseWeightedMode(savedState.useWeightedMode)
          }

          // Restore simulation results if available
          if (savedState.results) {
            setResults(savedState.results)
          }
        }
        setHasRestoredFromContext(true)
      }
    }
  }, [db, hasRestoredFromContext, getCascadeState])

  // Sync weighted fuel with fuel nuclides
  // Skip during initial state restoration to preserve saved proportions
  useEffect(() => {
    if (!hasRestoredFromContext) return

    if (fuelNuclides.length === 0) {
      setWeightedFuel([])
      return
    }

    // When fuel nuclides change, update weighted fuel to include new nuclides
    // and remove any that are no longer selected
    setWeightedFuel((prev) => {
      const existingMap = new Map(prev.map((n) => [n.nuclideId, n]))

      // Keep existing proportions for nuclides that are still selected
      const updated: WeightedNuclide[] = []
      for (const id of fuelNuclides) {
        if (existingMap.has(id)) {
          updated.push(existingMap.get(id)!)
        } else {
          // New nuclide - give it equal proportion
          updated.push({
            nuclideId: id,
            proportion: 100 / fuelNuclides.length,
            sourceType: 'manual',
          })
        }
      }

      // If proportions don't make sense anymore, redistribute equally
      const total = updated.reduce((sum, n) => sum + n.proportion, 0)
      if (total === 0 || updated.length !== prev.length) {
        return createEqualProportions(fuelNuclides, 'manual')
      }

      return updated
    })
  }, [fuelNuclides, hasRestoredFromContext])

  // Save state to context whenever it changes
  useEffect(() => {
    if (!hasRestoredFromContext) return

    updateCascadeState({
      temperature: params.temperature,
      minFusionMeV: params.minFusionMeV,
      minTwoToTwoMeV: params.minTwoToTwoMeV,
      maxNuclides: params.maxNuclides,
      maxLoops: params.maxLoops,
      feedbackBosons: params.feedbackBosons,
      feedbackFermions: params.feedbackFermions,
      allowDimers: params.allowDimers,
      excludeMelted: params.excludeMelted,
      excludeBoiledOff: params.excludeBoiledOff,
      fuelNuclides,
      results: results || undefined,
      // Weighted mode state (Issue #96)
      weightedFuel: weightedFuel.length > 0 ? weightedFuel : undefined,
      proportionFormat,
      useWeightedMode,
    })
  }, [
    hasRestoredFromContext,
    params.temperature,
    params.minFusionMeV,
    params.minTwoToTwoMeV,
    params.maxNuclides,
    params.maxLoops,
    params.feedbackBosons,
    params.feedbackFermions,
    params.allowDimers,
    params.excludeMelted,
    params.excludeBoiledOff,
    fuelNuclides,
    results,
    weightedFuel,
    proportionFormat,
    useWeightedMode,
    updateCascadeState,
  ])

  const handleRunSimulation = async () => {
    if (!db) {
      setError('Database not loaded yet. Please wait...')
      return
    }

    setError(null)
    setResults(null)

    try {
      // Validate fuel nuclides
      if (fuelNuclides.length === 0) {
        throw new Error('Please select at least one fuel nuclide')
      }

      // Export database to ArrayBuffer for worker
      const dbBuffer = db.export().buffer

      // Run cascade in worker (with weighted mode support - Issue #96)
      const cascadeResults = await runCascade({
        fuelNuclides: fuelNuclides,
        ...params,
        // Include weighted fuel configuration when enabled
        ...(useWeightedMode && weightedFuel.length > 0 ? {
          weightedFuel,
          useWeightedMode: true,
        } : {}),
      }, dbBuffer as ArrayBuffer)

      setResults(cascadeResults)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error occurred'
      setError(message)
      console.error('Cascade simulation error:', err)
    }
  }

  const handleReset = () => {
    setParams({
      temperature: 2400,
      minFusionMeV: 1.0,
      minTwoToTwoMeV: 1.0,
      maxNuclides: 5000,
      maxLoops: 25,
      feedbackBosons: true,
      feedbackFermions: true,
      allowDimers: true,
      excludeMelted: false,
      excludeBoiledOff: true,
    })
    setSliderMaxNuclides(5000)
    setSliderMaxLoops(25)
    setFuelNuclides(['H-1', 'Li-7', 'Al-27', 'N-14', 'Ni-58', 'Ni-60', 'Ni-62', 'B-10', 'B-11'])
    setResults(null)
    setError(null)
    // Reset weighted mode state
    setUseWeightedMode(false)
    setWeightedFuel([])
    setProportionFormat('percentage')
  }

  // Handle material selection from catalog
  const handleMaterialSelect = (nuclides: WeightedNuclide[]) => {
    // Extract unique nuclide IDs and update fuel selection
    const nuclideIds = nuclides.map((n) => n.nuclideId)
    setFuelNuclides(nuclideIds)
    setWeightedFuel(nuclides)
    setUseWeightedMode(true) // Enable weighted mode when loading a material
  }

  const handleDownloadCSV = () => {
    if (!results) return

    // Build CSV content
    const lines: string[] = []

    // Header
    lines.push('Loop,Type,Input1,Input2,Output1,Output2,Energy_MeV,Neutrino')

    // Reactions
    results.reactions.forEach((reaction) => {
      const input1 = reaction.inputs[0] || ''
      const input2 = reaction.inputs[1] || ''
      const output1 = reaction.outputs[0] || ''
      const output2 = reaction.outputs[1] || ''
      lines.push(
        `${reaction.loop},${reaction.type},${input1},${input2},${output1},${output2},${reaction.MeV},${reaction.neutrino}`
      )
    })

    // Add blank line
    lines.push('')
    lines.push('Product Distribution')
    lines.push('Nuclide,Count')

    // Product distribution
    Array.from(results.productDistribution.entries())
      .sort((a, b) => b[1] - a[1])
      .forEach(([nuclide, count]) => {
        lines.push(`${nuclide},${count}`)
      })

    // Create blob and download
    const csv = lines.join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)

    link.setAttribute('href', url)
    link.setAttribute('download', `cascade_results_${Date.now()}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  // Cycle discovery handlers (Issue #92)
  const handleCycleDiscoverySearch = async () => {
    if (!db) {
      setError('Database not loaded')
      return
    }

    setIsCycleSearching(true)
    setError(null)
    setSelectedCycle(null)

    try {
      const results = await discoverCycles(db, cycleDiscoveryParams)
      setCycleDiscoveryResults(results)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error occurred'
      setError(message)
      console.error('Cycle discovery error:', err)
    } finally {
      setIsCycleSearching(false)
    }
  }

  const handleViewCycle = (cycle: DiscoveredCycle) => {
    setSelectedCycle(cycle)
  }

  const handleRunCycleSimulation = async (cycle: DiscoveredCycle) => {
    // Pre-fill cascade simulation with cycle's fuel
    setFuelNuclides(cycle.fuelNuclides)
    setSelectedCycle(null) // Clear selected cycle to show results table again after simulation
    
    // Actually run the simulation automatically
    if (!db) {
      setError('Database not loaded yet. Please wait...')
      return
    }

    setError(null)
    setResults(null)

    try {
      // Validate fuel nuclides
      if (cycle.fuelNuclides.length === 0) {
        throw new Error('Cycle has no fuel nuclides')
      }

      // Export database to ArrayBuffer for worker
      const dbBuffer = db.export().buffer

      // Run cascade in worker
      const cascadeResults = await runCascade({
        fuelNuclides: cycle.fuelNuclides,
        ...params,
        // Include weighted fuel configuration when enabled
        ...(useWeightedMode && weightedFuel.length > 0 ? {
          weightedFuel,
          useWeightedMode: true,
        } : {}),
      }, dbBuffer as ArrayBuffer)

      setResults(cascadeResults)
      
      // Switch to summary tab to show results
      setActiveResultsTab('summary')
      
      // Scroll to results section
      setTimeout(() => {
        const resultsElement = document.getElementById('cascade-results')
        if (resultsElement) {
          resultsElement.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
      }, 100)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error occurred'
      setError(message)
      console.error('Cascade simulation error:', err)
    }
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">{t('cascades.simulationTitle')}</h1>
        <p className="text-gray-600 dark:text-gray-400">{t('cascades.simulationDescription')}</p>
      </div>

      <div className="card p-6 mb-6 bg-blue-50 dark:bg-blue-900/20">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-gray-700 dark:text-gray-300">
            <strong>{t('cascades.databaseLimitsTitle')}:</strong> {t('cascades.databaseLimitsDescription')}
          </div>
        </div>
      </div>

      <div className="card p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{t('cascades.fuelNuclides')}</h2>
          <div className="flex items-center gap-3 sm:gap-4">
            {/* Weighted Mode Toggle */}
            <label className="flex items-center gap-2 cursor-pointer">
              <div className="relative">
                <input
                  type="checkbox"
                  checked={useWeightedMode}
                  onChange={(e) => setUseWeightedMode(e.target.checked)}
                  className="sr-only"
                  data-testid="weighted-mode-toggle"
                />
                <div className={`w-10 h-6 rounded-full transition-colors ${
                  useWeightedMode ? 'bg-primary-600' : 'bg-gray-300 dark:bg-gray-600'
                }`}>
                  <div className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${
                    useWeightedMode ? 'translate-x-4' : ''
                  }`} />
                </div>
              </div>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                <Scale className="w-4 h-4" />
                <span className="xs:hidden">{t('cascades.weighted')}</span>
                <span className="hidden xs:inline">{t('cascades.weightedMode')}</span>
              </span>
            </label>
            {/* Materials Catalog Button */}
            <button
              type="button"
              onClick={() => setShowMaterialsCatalog(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              data-testid="materials-catalog-button"
            >
              <BookOpen className="w-4 h-4" />
              {t('cascades.materials')}
            </button>
          </div>
        </div>

        <PeriodicTableSelector
          label={t('cascades.selectIsotopesLabel')}
          availableElements={availableElements}
          selectedElements={fuelNuclides}
          onSelectionChange={setFuelNuclides}
          mode="nuclide"
          disableHydrogenIsotopes={true}
        />
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
          {t('cascades.selectIsotopesHint')}
        </p>

        {/* Weighted Proportions Input (shown when weighted mode is enabled) */}
        {useWeightedMode && fuelNuclides.length > 0 && (
          <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
            <ProportionInput
              nuclideIds={fuelNuclides}
              weightedNuclides={weightedFuel}
              onProportionsChange={setWeightedFuel}
              format={proportionFormat}
              onFormatChange={setProportionFormat}
              db={db}
              showFormatSelector={true}
              testId="fuel-proportion-input"
            />
          </div>
        )}

        {/* Weighted Mode Info */}
        {useWeightedMode && (
          <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="flex items-start gap-2">
              <Scale className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-700 dark:text-blue-300">
                <strong>{t('cascades.weightedMode')}:</strong> {t('cascades.weightedModeDescription')}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="card p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Settings className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{t('cascades.cascadeParameters')}</h2>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('cascades.temperatureK')}
            </label>
            <input
              type="number"
              className="input"
              value={params.temperature}
              onChange={(e) => setParams({...params, temperature: parseInt(e.target.value)})}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('cascades.minFusionEnergy')}
            </label>
            <input
              type="number"
              step="0.1"
              className="input"
              value={params.minFusionMeV}
              onChange={(e) => setParams({...params, minFusionMeV: parseFloat(e.target.value)})}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('cascades.minTwoToTwoEnergy')}
            </label>
            <input
              type="number"
              step="0.1"
              className="input"
              value={params.minTwoToTwoMeV}
              onChange={(e) => setParams({...params, minTwoToTwoMeV: parseFloat(e.target.value)})}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('cascades.maxNuclidesToPair')}: {sliderMaxNuclides}
            </label>
            <input
              type="range"
              min="10"
              max="10000"
              step="10"
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 accent-blue-600"
              value={sliderMaxNuclides}
              onInput={(e) => setSliderMaxNuclides(parseInt((e.target as HTMLInputElement).value))}
              onMouseUp={(e) => setParams({...params, maxNuclides: parseInt((e.target as HTMLInputElement).value)})}
              onTouchEnd={(e) => setParams({...params, maxNuclides: parseInt((e.target as HTMLInputElement).value)})}
            />
            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
              <span>10</span>
              <span>{t('cascades.databaseNuclidesCount')}</span>
              <span>10,000</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('cascades.maxCascadeLoops')}: {sliderMaxLoops}
            </label>
            <input
              type="range"
              min="1"
              max="100"
              step="1"
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 accent-blue-600"
              value={sliderMaxLoops}
              onInput={(e) => setSliderMaxLoops(parseInt((e.target as HTMLInputElement).value))}
              onMouseUp={(e) => setParams({...params, maxLoops: parseInt((e.target as HTMLInputElement).value)})}
              onTouchEnd={(e) => setParams({...params, maxLoops: parseInt((e.target as HTMLInputElement).value)})}
            />
            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
              <span>1</span>
              <span>{t('cascades.recommendedLoops')}</span>
              <span>100</span>
            </div>
          </div>
        </div>

        <div className="mt-6">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">{t('cascades.feedbackOptions')}</h3>
          <div className="space-y-3">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={params.feedbackBosons}
                onChange={(e) => setParams({...params, feedbackBosons: e.target.checked})}
                className="mr-2"
              />
              <span className="text-sm">{t('cascades.feedbackBosons')}</span>
            </label>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={params.feedbackFermions}
                onChange={(e) => setParams({...params, feedbackFermions: e.target.checked})}
                className="mr-2"
              />
              <span className="text-sm">{t('cascades.feedbackFermions')}</span>
            </label>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={params.allowDimers}
                onChange={(e) => setParams({...params, allowDimers: e.target.checked})}
                className="mr-2"
              />
              <span className="text-sm">{t('cascades.allowDimers')}</span>
            </label>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={params.excludeMelted}
                onChange={(e) => setParams({...params, excludeMelted: e.target.checked})}
                className="mr-2"
              />
              <span className="text-sm">{t('cascades.excludeMelted')}</span>
            </label>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={params.excludeBoiledOff}
                onChange={(e) => setParams({...params, excludeBoiledOff: e.target.checked})}
                className="mr-2"
              />
              <span className="text-sm">{t('cascades.excludeBoiledOff')}</span>
            </label>
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <button
          className="btn btn-primary px-8 py-3"
          onClick={handleRunSimulation}
          disabled={isRunning || !db}
        >
          {isRunning ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 inline animate-spin" />
              {t('cascades.running')}
            </>
          ) : (
            <>
              <Play className="w-5 h-5 mr-2 inline" />
              {t('cascades.runSimulation')}
            </>
          )}
        </button>
        <button
          className="btn btn-secondary px-8 py-3"
          onClick={handleReset}
          disabled={isRunning}
        >
          {t('cascades.resetParameters')}
        </button>
      </div>

      {/* Progress Display */}
      {isRunning && progress && (
        <div className="mt-6">
          <CascadeProgressCard progress={progress} onCancel={cancelCascade} />
        </div>
      )}

      {/* Error Display */}
      {(error || workerError) && (
        <div className="card p-6 mt-6 bg-red-50 dark:bg-red-900/20">
          <div className="flex items-start gap-3">
            <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-red-900 dark:text-red-100 mb-1">{t('common.error')}</h3>
              <p className="text-sm text-red-700 dark:text-red-200">{error || workerError}</p>
            </div>
          </div>
        </div>
      )}

      {/* Results Display */}
      {results && (
        <div id="cascade-results" className="mt-6 space-y-6">
          {/* Completion Banner */}
          <div className="card p-6 bg-green-50 dark:bg-green-900/20">
            <div className="flex items-start gap-3">
              <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-green-900 dark:text-green-100">
                    {t('cascades.cascadeComplete')}
                  </h3>
                  <button
                    onClick={handleDownloadCSV}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    {t('cascades.downloadCsv')}
                  </button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">{t('cascades.reactionsFound')}</span>
                    <p className="text-lg font-semibold text-gray-900 dark:text-white">
                      {results.reactions.length}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">{t('cascades.loopsExecuted')}</span>
                    <p className="text-lg font-semibold text-gray-900 dark:text-white">
                      {results.loopsExecuted}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">{t('cascades.totalEnergy')}</span>
                    <p className="text-lg font-semibold text-gray-900 dark:text-white">
                      {results.totalEnergy.toFixed(2)} MeV
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">{t('cascades.executionTime')}</span>
                    <p className="text-lg font-semibold text-gray-900 dark:text-white">
                      {results.executionTime.toFixed(0)} ms
                    </p>
                  </div>
                </div>
                <div className="mt-3 text-xs text-gray-600 dark:text-gray-400">
                  <span className="font-medium">{t('cascades.termination')}: </span>
                  {results.terminationReason === 'max_loops' && t('cascades.terminationMaxLoops')}
                  {results.terminationReason === 'no_new_products' && t('cascades.terminationNoNewProducts')}
                  {results.terminationReason === 'max_nuclides' && t('cascades.terminationMaxNuclides')}
                </div>
              </div>
            </div>
          </div>

          {/* Tabbed Results Interface */}
          {results.reactions.length > 0 ? (
            <CascadeTabs
              results={results}
              fuelNuclides={fuelNuclides}
              cycleDiscoveryParams={cycleDiscoveryParams}
              cycleDiscoveryResults={cycleDiscoveryResults ?? undefined}
              selectedCycle={selectedCycle}
              onCycleDiscoveryParamsChange={setCycleDiscoveryParams}
              onCycleDiscoverySearch={handleCycleDiscoverySearch}
              onViewCycle={handleViewCycle}
              onRunCycleSimulation={handleRunCycleSimulation}
              isCycleSearching={isCycleSearching}
              activeTab={activeResultsTab}
              onTabChange={setActiveResultsTab}
            />
          ) : (
            <div className="card p-6 bg-yellow-50 dark:bg-yellow-900/20">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-yellow-900 dark:text-yellow-100 mb-1">
                    {t('cascades.noReactionsFound')}
                  </h3>
                  <p className="text-sm text-yellow-700 dark:text-yellow-200">
                    {t('cascades.noReactionsFoundDescription')}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {!results && (
        <div className="card p-6 mt-6 bg-blue-50 dark:bg-blue-900/30">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-2">{t('cascades.howCascadesWork')}</h3>
          <ol className="text-sm text-gray-700 dark:text-gray-300 space-y-2 list-decimal list-inside">
            <li>{t('cascades.howStep1')}</li>
            <li>{t('cascades.howStep2')}</li>
            <li>{t('cascades.howStep3')}</li>
            <li>{t('cascades.howStep4')}</li>
            <li>{t('cascades.howStep5')}</li>
          </ol>
        </div>
      )}

      {/* Materials Catalog Modal */}
      <MaterialsCatalog
        isOpen={showMaterialsCatalog}
        onClose={() => setShowMaterialsCatalog(false)}
        onSelectMaterial={handleMaterialSelect}
        currentFuel={weightedFuel}
      />
    </div>
  )
}
