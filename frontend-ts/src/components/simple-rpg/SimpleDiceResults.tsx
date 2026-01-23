'use client';

import { Dices } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import type { SimpleDiceResult } from '@/lib/types';

interface SimpleDiceResultsProps {
  result: SimpleDiceResult;
}

export function SimpleDiceResults({ result }: SimpleDiceResultsProps) {
  const getOutcomeStyle = () => {
    switch (result.outcome) {
      case 'full_success':
        return {
          bg: 'bg-green-500/10 border-green-500/30',
          text: 'text-green-600',
          label: 'Success!',
          sublabel: '10+',
        };
      case 'partial_success':
        return {
          bg: 'bg-yellow-500/10 border-yellow-500/30',
          text: 'text-yellow-600',
          label: 'Partial Success',
          sublabel: '7-9',
        };
      case 'miss':
        return {
          bg: 'bg-red-500/10 border-red-500/30',
          text: 'text-red-600',
          label: 'Complication',
          sublabel: '6-',
        };
      default:
        return {
          bg: 'bg-gray-500/10 border-gray-500/30',
          text: 'text-gray-600',
          label: 'Roll',
          sublabel: '',
        };
    }
  };

  const style = getOutcomeStyle();

  const formatModifier = (mod: number) => {
    if (mod >= 0) return `+${mod}`;
    return `${mod}`;
  };

  return (
    <Card className={`${style.bg} border animate-in fade-in slide-in-from-bottom-2 duration-300`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-amber-500/20">
              <Dices className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <div className={`font-bold ${style.text}`}>
                {style.label} <span className="text-muted-foreground font-normal">({style.sublabel})</span>
              </div>
              <div className="text-sm text-muted-foreground">
                2d6 ={' '}
                <span className="font-mono font-bold">{result.roll}</span>
                {result.attributeUsed && (
                  <>
                    {' '}+ {result.attributeUsed} (
                    <span className="font-mono">{formatModifier(result.modifier)}</span>)
                  </>
                )}
                {' '}={' '}
                <span className={`font-mono font-bold ${style.text}`}>{result.total}</span>
              </div>
            </div>
          </div>

          {/* Visual dice */}
          <div className="flex gap-1">
            <DiceFace value={Math.ceil(result.roll / 2)} />
            <DiceFace value={Math.floor(result.roll / 2) || 1} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function DiceFace({ value }: { value: number }) {
  // Clamp value between 1-6
  const safeValue = Math.max(1, Math.min(6, value));

  return (
    <div className="w-10 h-10 bg-white rounded-lg border-2 border-gray-300 flex items-center justify-center shadow-sm">
      <span className="text-lg font-bold text-gray-700">{safeValue}</span>
    </div>
  );
}
