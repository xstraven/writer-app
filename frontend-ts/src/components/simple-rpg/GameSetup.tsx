'use client';

import { useState } from 'react';
import { Loader2, Sparkles, RefreshCw, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useSimpleGameStore } from '@/stores/simpleGameStore';
import { generateSimpleAttributes } from '@/lib/api';
import type { SimpleAttribute } from '@/lib/types';

export function GameSetup() {
  const {
    adventureName,
    worldSetting,
    attributes,
    setAdventure,
    setAttributes,
    advanceToPlayers,
  } = useSimpleGameStore();

  const [localName, setLocalName] = useState(adventureName);
  const [localSetting, setLocalSetting] = useState(worldSetting);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerateAttributes = async () => {
    if (!localSetting.trim()) {
      setError('Please describe your adventure setting first!');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const response = await generateSimpleAttributes(localSetting);
      setAttributes(response.attributes);
      setAdventure(localName || 'Untitled Adventure', localSetting);
    } catch (err) {
      console.error('Failed to generate attributes:', err);
      setError('Failed to generate attributes. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleContinue = () => {
    if (attributes.length === 0) {
      setError('Please generate attributes first!');
      return;
    }
    setAdventure(localName || 'Untitled Adventure', localSetting);
    advanceToPlayers();
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-500" />
            Create Your Adventure
          </CardTitle>
          <CardDescription>
            Describe the world where your adventure will take place
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="adventure-name">Adventure Name (optional)</Label>
            <Input
              id="adventure-name"
              placeholder="The Quest for the Golden Acorn"
              value={localName}
              onChange={(e) => setLocalName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="world-setting">World Setting</Label>
            <Textarea
              id="world-setting"
              placeholder="A magical forest where talking animals live in cozy tree houses. There's a friendly dragon who runs the bakery, mischievous pixies who love pranks, and a wise old owl who teaches at the forest school..."
              value={localSetting}
              onChange={(e) => setLocalSetting(e.target.value)}
              className="min-h-[120px]"
            />
            <p className="text-xs text-muted-foreground">
              Be creative! The more details you add, the better the AI can create fitting attributes.
            </p>
          </div>

          {error && (
            <p className="text-sm text-red-500">{error}</p>
          )}

          <Button
            onClick={handleGenerateAttributes}
            disabled={isGenerating || !localSetting.trim()}
            className="w-full"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating Adventure...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                {attributes.length > 0 ? 'Regenerate Attributes' : 'Create Adventure'}
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {attributes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Character Attributes</CardTitle>
            <CardDescription>
              These attributes will define what your characters are good at
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3">
              {attributes.map((attr, idx) => (
                <AttributeCard key={idx} attribute={attr} />
              ))}
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleGenerateAttributes}
                disabled={isGenerating}
                className="flex-1"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isGenerating ? 'animate-spin' : ''}`} />
                Regenerate
              </Button>
              <Button onClick={handleContinue} className="flex-1">
                Add Players
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function AttributeCard({ attribute }: { attribute: SimpleAttribute }) {
  return (
    <div className="p-3 rounded-lg border bg-card">
      <div className="font-medium">{attribute.name}</div>
      <div className="text-sm text-muted-foreground">{attribute.description}</div>
    </div>
  );
}
