'use client';

import { Dices, Check, X } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import type { RPGActionResult } from '@/lib/types';

interface DiceResultsProps {
  results: RPGActionResult[];
}

export function DiceResults({ results }: DiceResultsProps) {
  if (results.length === 0) return null;

  return (
    <Card className="border-amber-500/30 bg-amber-500/5">
      <CardContent className="p-3 space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium text-amber-500">
          <Dices className="h-4 w-4" />
          Dice Results
        </div>

        {results.map((result, idx) => (
          <div
            key={idx}
            className={`p-2 rounded-md text-sm ${
              result.success
                ? 'bg-green-500/10 border border-green-500/30'
                : 'bg-red-500/10 border border-red-500/30'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-medium">{result.check_type}</span>
              {result.success ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : (
                <X className="h-4 w-4 text-red-500" />
              )}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Rolled{' '}
              <span className="font-mono font-bold">{result.roll_result}</span>
              {result.modifier !== 0 && (
                <>
                  {' '}
                  + <span className="font-mono">{result.modifier}</span>
                </>
              )}
              {' '}={' '}
              <span className="font-mono font-bold">{result.total}</span>
              {' '}vs DC{' '}
              <span className="font-mono">{result.target_number}</span>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
