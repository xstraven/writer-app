'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft, RotateCcw, Dices } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSimpleGameStore } from '@/stores/simpleGameStore';
import { GameSetup } from '@/components/simple-rpg/GameSetup';
import { PlayerSetup } from '@/components/simple-rpg/PlayerSetup';
import { SimpleGameView } from '@/components/simple-rpg/SimpleGameView';
import { useExperimentalDarkMode } from '@/hooks/useExperimentalDarkMode';

export default function SimpleRPGPage() {
  const router = useRouter();
  useExperimentalDarkMode();

  const { status, adventureName, resetGame } = useSimpleGameStore();

  const handleReset = () => {
    if (status === 'active') {
      if (!confirm('Are you sure you want to start a new game? Current progress will be lost.')) {
        return;
      }
    }
    resetGame();
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b sticky top-0 bg-background/95 backdrop-blur z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push('/')}
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
              <div className="h-6 w-px bg-border" />
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-gradient-to-br from-purple-500 to-pink-600">
                  <Dices className="h-4 w-4 text-white" />
                </div>
                <div>
                  <h1 className="font-bold">
                    {status === 'active' && adventureName
                      ? adventureName
                      : 'Quick Adventure'}
                  </h1>
                  {status !== 'setup' && (
                    <p className="text-xs text-muted-foreground">
                      Family-friendly fun!
                    </p>
                  )}
                </div>
              </div>
            </div>

            {status !== 'setup' && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleReset}
              >
                <RotateCcw className="h-4 w-4 mr-1" />
                New Game
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {status === 'setup' && <GameSetup />}
        {status === 'players' && <PlayerSetup />}
        {status === 'active' && <SimpleGameView />}
      </main>

      {/* Footer */}
      <footer className="border-t mt-auto">
        <div className="max-w-7xl mx-auto px-4 py-4 text-center text-sm text-muted-foreground">
          {status === 'setup' && 'Step 1 of 3: Create Your Adventure'}
          {status === 'players' && 'Step 2 of 3: Add Heroes'}
          {status === 'active' && 'Adventure in Progress'}
        </div>
      </footer>
    </div>
  );
}
