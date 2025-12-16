/**
 * Cycle Sankey Diagram Component
 *
 * Visualizes a single discovered cycle using a Sankey diagram.
 * Shows the flow from fuel nuclides through reactions with feedback highlighting.
 */

import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Sankey, Tooltip, ResponsiveContainer, Rectangle } from 'recharts';
import type { DiscoveredCycle } from '../types';
import { SankeyErrorBoundary } from './SankeyErrorBoundary';

interface CycleSankeyDiagramProps {
  cycle: DiscoveredCycle;
}

/**
 * Convert cycle reactions to Sankey diagram format
 */
function cycleToSankeyData(cycle: DiscoveredCycle) {
  const nodeMap = new Map<string, number>();
  const nodes: Array<{ name: string; type: 'fuel' | 'intermediate' | 'product' | 'feedback'; color: string }> = [];
  const links: Array<{ source: number; target: number; value: number; reactionIndex: number; isFeedback: boolean }> = [];

  const fuelSet = new Set(cycle.fuelNuclides);

  // Collect all unique nuclides
  const allNuclides = new Set<string>();
  cycle.fuelNuclides.forEach((n) => allNuclides.add(n));
  cycle.reactions.forEach((r) => {
    r.inputs.forEach((n) => allNuclides.add(n));
    r.outputs.forEach((n) => allNuclides.add(n));
  });

  // Track which nuclides appear as outputs (to identify final products)
  const outputNuclides = new Set<string>();
  cycle.reactions.forEach((r) => {
    r.outputs.forEach((n) => outputNuclides.add(n));
  });

  // Track which nuclides are used as inputs in later reactions (feedback)
  const feedbackNuclides = new Set<string>();
  cycle.reactions.forEach((reaction, idx) => {
    reaction.outputs.forEach((output) => {
      // Check if this output is used as input in any later reaction
      for (let i = idx + 1; i < cycle.reactions.length; i++) {
        if (cycle.reactions[i].inputs.includes(output)) {
          feedbackNuclides.add(output);
        }
      }
      // Also check if output is in fuel set (direct feedback)
      if (fuelSet.has(output)) {
        feedbackNuclides.add(output);
      }
    });
  });

  // Create nodes
  Array.from(allNuclides).forEach((nuclide) => {
    let type: 'fuel' | 'intermediate' | 'product' | 'feedback';
    let color: string;

    if (fuelSet.has(nuclide)) {
      type = 'fuel';
      color = '#10b981'; // Green for fuel
    } else if (feedbackNuclides.has(nuclide)) {
      type = 'feedback';
      color = '#fbbf24'; // Yellow for feedback nuclides
    } else if (!outputNuclides.has(nuclide)) {
      type = 'product';
      color = '#f97316'; // Orange for final products
    } else {
      type = 'intermediate';
      color = '#3b82f6'; // Blue for intermediates
    }

    nodeMap.set(nuclide, nodes.length);
    nodes.push({ name: nuclide, type, color });
  });

  // Create links
  cycle.reactions.forEach((reaction, reactionIndex) => {
    if (reaction.type === 'fusion' && reaction.inputs.length === 2 && reaction.outputs.length === 1) {
      const input1Idx = nodeMap.get(reaction.inputs[0])!;
      const input2Idx = nodeMap.get(reaction.inputs[1])!;
      const outputIdx = nodeMap.get(reaction.outputs[0])!;

      // Create links from both inputs to output
      links.push({
        source: input1Idx,
        target: outputIdx,
        value: reaction.MeV,
        reactionIndex,
        isFeedback: reaction.isFeedback,
      });
      links.push({
        source: input2Idx,
        target: outputIdx,
        value: reaction.MeV,
        reactionIndex,
        isFeedback: reaction.isFeedback,
      });
    } else if (reaction.type === 'twotwo' && reaction.inputs.length === 2 && reaction.outputs.length === 2) {
      const input1Idx = nodeMap.get(reaction.inputs[0])!;
      const input2Idx = nodeMap.get(reaction.inputs[1])!;
      const output1Idx = nodeMap.get(reaction.outputs[0])!;
      const output2Idx = nodeMap.get(reaction.outputs[1])!;

      links.push({
        source: input1Idx,
        target: output1Idx,
        value: reaction.MeV / 2,
        reactionIndex,
        isFeedback: reaction.isFeedback,
      });
      links.push({
        source: input2Idx,
        target: output2Idx,
        value: reaction.MeV / 2,
        reactionIndex,
        isFeedback: reaction.isFeedback,
      });
    } else if (reaction.type === 'fission' && reaction.inputs.length === 1 && reaction.outputs.length === 2) {
      const inputIdx = nodeMap.get(reaction.inputs[0])!;
      const output1Idx = nodeMap.get(reaction.outputs[0])!;
      const output2Idx = nodeMap.get(reaction.outputs[1])!;

      links.push({
        source: inputIdx,
        target: output1Idx,
        value: reaction.MeV / 2,
        reactionIndex,
        isFeedback: reaction.isFeedback,
      });
      links.push({
        source: inputIdx,
        target: output2Idx,
        value: reaction.MeV / 2,
        reactionIndex,
        isFeedback: reaction.isFeedback,
      });
    }
  });

  return { nodes, links };
}

export default function CycleSankeyDiagram({ cycle }: CycleSankeyDiagramProps) {
  const { t } = useTranslation();
  const [renderError, setRenderError] = useState<string | null>(null);

  // Convert cycle to Sankey data
  const sankeyData = useMemo(() => cycleToSankeyData(cycle), [cycle]);

  if (sankeyData.nodes.length === 0 || sankeyData.links.length === 0) {
    return (
      <div className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
        {t('cascades.cycleDiscovery.noSankeyData', 'Unable to generate flow diagram for this cycle.')}
      </div>
    );
  }

  // Custom link renderer
  const CustomLink = (props: any) => {
    const { sourceX, sourceY, targetX, targetY, sourceControlX, targetControlX, index } = props;
    const linkData = sankeyData.links[index];
    
    if (!linkData) {
      return <g />;
    }

    const sourceNode = sankeyData.nodes[linkData.source];
    const targetNode = sankeyData.nodes[linkData.target];
    
    if (!sourceNode || !targetNode) {
      return <g />;
    }
    
    // Calculate thickness from link value
    const linkValues = sankeyData.links.map(l => l.value);
    const minValue = Math.min(...linkValues);
    const maxValue = Math.max(...linkValues);
    const normalizedValue = maxValue > minValue
      ? (linkData.value - minValue) / (maxValue - minValue)
      : 0.5;
    const thickness = 2 + (normalizedValue * 28); // 2-30px range
    const halfThickness = thickness / 2;

    const pathD = `
      M${sourceX},${sourceY - halfThickness}
      C${sourceControlX},${sourceY - halfThickness} ${targetControlX},${targetY - halfThickness} ${targetX},${targetY - halfThickness}
      L${targetX},${targetY + halfThickness}
      C${targetControlX},${targetY + halfThickness} ${sourceControlX},${sourceY + halfThickness} ${sourceX},${sourceY + halfThickness}
      Z
    `;

    // Color based on feedback
    const linkColor = linkData.isFeedback ? '#fbbf24' : '#9ca3af';
    const linkOpacity = linkData.isFeedback ? 0.6 : 0.4;

    const tooltipText = `${sourceNode.name} → ${targetNode.name}\n${linkData.value.toFixed(2)} MeV${linkData.isFeedback ? '\n✓ Feedback' : ''}`;

    return (
      <g>
        <title>{tooltipText}</title>
        {/* Visible path */}
        <path
          d={pathD}
          fill={linkColor}
          fillOpacity={linkOpacity}
          stroke="none"
          pointerEvents="none"
        />
        {/* Invisible larger hitbox for tooltips */}
        <path
          d={pathD}
          fill="transparent"
          stroke="transparent"
          strokeWidth={Math.max(thickness, 10)}
          style={{ cursor: 'pointer' }}
          pointerEvents="all"
        />
      </g>
    );
  };

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;

    const data = payload[0].payload;
    if (!data || data.source === undefined || data.target === undefined) return null;

    const sourceNode = sankeyData.nodes[data.source];
    const targetNode = sankeyData.nodes[data.target];
    
    if (!sourceNode || !targetNode) return null;

    const linkData = sankeyData.links.find((l) => l.source === data.source && l.target === data.target);

    return (
      <div className="bg-white dark:bg-gray-800 p-2 border border-gray-200 dark:border-gray-700 rounded shadow-lg">
        <p className="text-sm font-medium text-gray-900 dark:text-white">
          {sourceNode.name} → {targetNode.name}
        </p>
        {data.value && (
          <p className="text-xs text-gray-600 dark:text-gray-400">
            {data.value.toFixed(2)} MeV
          </p>
        )}
        {linkData?.isFeedback && (
          <p className="text-xs text-yellow-600 dark:text-yellow-400 font-medium mt-1">
            ✓ Feedback
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Error Message */}
      {renderError && (
        <div className="card p-4 bg-red-50 dark:bg-red-900/20 border-2 border-red-500 dark:border-red-400">
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <h4 className="font-semibold text-red-900 dark:text-red-100 mb-2">
                {t('cascades.sankey.renderError', 'Rendering Error')}
              </h4>
              <p className="text-sm text-red-800 dark:text-red-200">
                {renderError}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Sankey Diagram */}
      {!renderError && (
        <div className="overflow-hidden rounded-lg">
          <SankeyErrorBoundary
            onError={(error) => {
              console.error('Cycle Sankey Error Boundary caught:', error);
              const message = error.message || String(error);
              setRenderError(`Rendering error: ${message}`);
            }}
          >
            <ResponsiveContainer width="100%" height={500}>
              <Sankey
                data={{
                  nodes: sankeyData.nodes.map((n) => ({ name: n.name })),
                  links: sankeyData.links.map((l) => ({
                    source: l.source,
                    target: l.target,
                    value: l.value,
                  })),
                }}
                link={CustomLink}
                node={(nodeProps: any) => {
                  const { x, y, width, height, index, containerWidth } = nodeProps;
                  const node = sankeyData.nodes[index];

                  if (!node) {
                    return <g />;
                  }

                  // Determine label position
                  const isLeftSide = x < containerWidth / 3;
                  const isRightSide = x > (containerWidth * 2) / 3;

                  const labelX = isLeftSide
                    ? x - 12
                    : isRightSide
                      ? x + width + 12
                      : x + width / 2;

                  const labelY = isLeftSide || isRightSide
                    ? y + height / 2
                    : y - 12;

                  const textAnchor = isLeftSide
                    ? 'end'
                    : isRightSide
                      ? 'start'
                      : 'middle';

                  return (
                    <g>
                      <title>{node.name}</title>
                      <Rectangle
                        x={x}
                        y={y}
                        width={width}
                        height={height}
                        fill={node.color}
                        stroke="#1f2937"
                        strokeWidth={2}
                        radius={4}
                      />
                      <text
                        x={labelX}
                        y={labelY}
                        textAnchor={textAnchor}
                        dominantBaseline="middle"
                        fill="currentColor"
                        className="fill-gray-900 dark:fill-white"
                        fontWeight="700"
                        fontSize="14px"
                        style={{
                          pointerEvents: 'none',
                          textShadow: '0 0 3px rgba(255,255,255,0.8), 0 0 6px rgba(255,255,255,0.6)',
                        }}
                      >
                        {node.name}
                      </text>
                    </g>
                  );
                }}
                nodePadding={60}
                margin={{ top: 30, right: 120, bottom: 30, left: 120 }}
              >
                <Tooltip content={<CustomTooltip />} />
              </Sankey>
            </ResponsiveContainer>
          </SankeyErrorBoundary>
        </div>
      )}
    </div>
  );
}
