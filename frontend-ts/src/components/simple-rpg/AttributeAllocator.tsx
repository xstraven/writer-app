'use client';

import { Button } from '@/components/ui/button';
import type { SimpleAttribute } from '@/lib/types';

interface AttributeAllocatorProps {
  attributes: SimpleAttribute[];
  availableModifiers: number[];
  currentScores: Record<string, number>;
  onChange: (scores: Record<string, number>) => void;
}

export function AttributeAllocator({
  attributes,
  availableModifiers,
  currentScores,
  onChange,
}: AttributeAllocatorProps) {
  // Get unassigned modifiers
  const usedModifiers = Object.values(currentScores);
  const getUnassignedModifiers = () => {
    const remaining = [...availableModifiers];
    for (const used of usedModifiers) {
      const idx = remaining.indexOf(used);
      if (idx !== -1) {
        remaining.splice(idx, 1);
      }
    }
    return remaining.sort((a, b) => b - a); // Sort descending
  };

  const unassignedModifiers = getUnassignedModifiers();

  const handleAssign = (attrName: string, modifier: number) => {
    const newScores = { ...currentScores };

    // If this attribute already has a score, we're replacing it
    if (attrName in newScores) {
      // The old score will be available again (handled by getUnassignedModifiers)
    }

    newScores[attrName] = modifier;
    onChange(newScores);
  };

  const handleClear = (attrName: string) => {
    const newScores = { ...currentScores };
    delete newScores[attrName];
    onChange(newScores);
  };

  const formatModifier = (mod: number) => {
    if (mod >= 0) return `+${mod}`;
    return `${mod}`;
  };

  const getModifierColor = (mod: number) => {
    if (mod >= 2) return 'bg-green-500 text-white';
    if (mod >= 1) return 'bg-green-400 text-white';
    if (mod === 0) return 'bg-gray-400 text-white';
    return 'bg-red-400 text-white';
  };

  return (
    <div className="space-y-4">
      {/* Instructions */}
      <div className="text-sm text-muted-foreground p-3 bg-muted/50 rounded-lg">
        <p className="mb-2">Assign these modifiers to your attributes:</p>
        <div className="flex gap-2 flex-wrap">
          {availableModifiers.map((mod, idx) => (
            <span
              key={idx}
              className={`px-2 py-1 rounded text-sm font-mono ${
                usedModifiers.includes(mod) &&
                usedModifiers.filter((m) => m === mod).length >
                  availableModifiers.filter((m) => m === mod).length -
                    unassignedModifiers.filter((m) => m === mod).length
                  ? 'opacity-30'
                  : ''
              } ${getModifierColor(mod)}`}
            >
              {formatModifier(mod)}
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
                      className={`px-3 py-1 rounded font-mono font-bold ${getModifierColor(currentScore)}`}
                    >
                      {formatModifier(currentScore)}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleClear(attr.name)}
                      className="text-muted-foreground"
                    >
                      Change
                    </Button>
                  </>
                ) : (
                  <div className="flex gap-1">
                    {Array.from(new Set(unassignedModifiers)).map((mod) => (
                      <Button
                        key={mod}
                        variant="outline"
                        size="sm"
                        onClick={() => handleAssign(attr.name, mod)}
                        className={`font-mono ${getModifierColor(mod)} border-0`}
                      >
                        {formatModifier(mod)}
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
      {unassignedModifiers.length === 0 && (
        <p className="text-sm text-green-600 text-center">
          All modifiers assigned!
        </p>
      )}
    </div>
  );
}
