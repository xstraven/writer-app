'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import type { SimpleAttribute } from '@/lib/types';

type DisplayMode = 'modifier' | 'value';

/**
 * Returns the appropriate value pool based on attribute count and game style.
 * Narrative/hybrid: PbtA modifiers scaled to attribute count.
 * Mechanical: D&D standard array trimmed/extended to attribute count.
 */
export function getValuePool(
  attributeCount: number,
  style: 'narrative' | 'mechanical' | 'hybrid' = 'narrative',
): number[] {
  if (style === 'mechanical') {
    const fullArray = [16, 14, 12, 10, 8];
    if (attributeCount <= 5) return fullArray.slice(0, attributeCount);
    // >5: extend with 8s
    return [...fullArray, ...Array(attributeCount - 5).fill(8)];
  }
  // Narrative / hybrid: PbtA modifiers
  if (attributeCount <= 3) return [2, 1, 0].slice(0, attributeCount);
  if (attributeCount === 4) return [2, 1, 0, -1];
  return [2, 1, 1, 0, -1].slice(0, attributeCount);
}

/** Map game style to the effective style for attribute display ('modifier' vs 'value'). */
export function getDisplayMode(style: 'narrative' | 'mechanical' | 'hybrid'): DisplayMode {
  return style === 'mechanical' ? 'value' : 'modifier';
}

/** Map game style to the effective CharacterFormFields style (hybrid → narrative). */
export function getEffectiveStyle(style: 'narrative' | 'mechanical' | 'hybrid'): 'narrative' | 'mechanical' {
  return style === 'mechanical' ? 'mechanical' : 'narrative';
}

interface AttributeAllocatorProps {
  attributes: SimpleAttribute[];
  availableValues: number[];
  currentScores: Record<string, number>;
  onChange: (scores: Record<string, number>) => void;
  displayMode?: DisplayMode;
}

/** Convert a D&D ability score to its modifier string, e.g. 16 → "+3" */
function dndModifier(value: number): string {
  const mod = Math.floor((value - 10) / 2);
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

export function AttributeAllocator({
  attributes,
  availableValues,
  currentScores,
  onChange,
  displayMode = 'modifier',
}: AttributeAllocatorProps) {
  const t = useTranslations('shared.attributeAllocator');
  const isModifierMode = displayMode === 'modifier';

  // Get unassigned values
  const usedValues = Object.values(currentScores);
  const getUnassignedValues = () => {
    const remaining = [...availableValues];
    for (const used of usedValues) {
      const idx = remaining.indexOf(used);
      if (idx !== -1) {
        remaining.splice(idx, 1);
      }
    }
    return remaining.sort((a, b) => b - a); // Sort descending
  };

  const unassignedValues = getUnassignedValues();

  const handleAssign = (attrName: string, value: number) => {
    const newScores = { ...currentScores };
    newScores[attrName] = value;
    onChange(newScores);
  };

  const handleClear = (attrName: string) => {
    const newScores = { ...currentScores };
    delete newScores[attrName];
    onChange(newScores);
  };

  const formatValue = (val: number) => {
    if (isModifierMode) {
      return val >= 0 ? `+${val}` : `${val}`;
    }
    // Value mode: show raw score with D&D modifier
    return `${val} (${dndModifier(val)})`;
  };

  const formatValueCompact = (val: number) => {
    if (isModifierMode) {
      return val >= 0 ? `+${val}` : `${val}`;
    }
    return `${val}`;
  };

  const getValueColor = (val: number) => {
    if (isModifierMode) {
      if (val >= 2) return 'bg-green-500 text-white';
      if (val >= 1) return 'bg-green-400 text-white';
      if (val === 0) return 'bg-gray-400 text-white';
      return 'bg-red-400 text-white';
    }
    // Value mode: color by D&D score
    if (val >= 16) return 'bg-green-500 text-white';
    if (val >= 14) return 'bg-green-400 text-white';
    if (val >= 12) return 'bg-blue-400 text-white';
    if (val >= 10) return 'bg-gray-400 text-white';
    return 'bg-red-400 text-white';
  };

  return (
    <div className="space-y-4">
      {/* Instructions */}
      <div className="text-sm text-muted-foreground p-3 bg-muted/50 rounded-lg">
        <p className="mb-2">
          {isModifierMode
            ? t('assignModifiers')
            : t('assignScores')}
        </p>
        <div className="flex gap-2 flex-wrap">
          {availableValues.map((val, idx) => (
            <span
              key={idx}
              className={`px-2 py-1 rounded text-sm font-mono ${
                usedValues.includes(val) &&
                usedValues.filter((m) => m === val).length >
                  availableValues.filter((m) => m === val).length -
                    unassignedValues.filter((m) => m === val).length
                  ? 'opacity-30'
                  : ''
              } ${getValueColor(val)}`}
            >
              {formatValue(val)}
            </span>
          ))}
        </div>
      </div>

      {/* Attributes */}
      <div className="grid gap-3">
        {attributes.map((attr) => {
          const currentScore = currentScores[attr.name];
          const hasScore = currentScore !== undefined;

          return (
            <div
              key={attr.name}
              className="flex items-center justify-between p-3 rounded-lg border bg-card"
            >
              <div className="flex-1">
                <div className="font-medium">{attr.name}</div>
                <div className="text-xs text-muted-foreground">{attr.description}</div>
              </div>

              <div className="flex items-center gap-2 ml-4">
                {hasScore ? (
                  <>
                    <span
                      className={`px-3 py-1 rounded font-mono font-bold ${getValueColor(currentScore)}`}
                    >
                      {formatValue(currentScore)}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleClear(attr.name)}
                      className="text-muted-foreground"
                    >
                      {t('change')}
                    </Button>
                  </>
                ) : (
                  <div className="flex gap-1">
                    {Array.from(new Set(unassignedValues)).map((val) => (
                      <Button
                        key={val}
                        variant="outline"
                        size="sm"
                        onClick={() => handleAssign(attr.name, val)}
                        className={`font-mono ${getValueColor(val)} border-0`}
                      >
                        {formatValueCompact(val)}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Status */}
      {unassignedValues.length === 0 && (
        <p className="text-sm text-green-600 text-center">
          {isModifierMode ? t('allModifiersAssigned') : t('allScoresAssigned')}
        </p>
      )}
    </div>
  );
}
