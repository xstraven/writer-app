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

interface AdventureTemplate {
  title: string;
  tagline: string;
  emoji: string;
  name: string;
  worldSetting: string;
}

const ADVENTURE_TEMPLATES: AdventureTemplate[] = [
  {
    title: 'Dragon\'s Peak',
    tagline: 'Classic fantasy quest to slay a dragon',
    emoji: '\uD83D\uDC09',
    name: 'The Dragon of Ashenmount',
    worldSetting: 'The kingdom of Valdris lives in the shadow of Ashenmount, a volcanic peak where the ancient red dragon Scorrath has awoken after centuries of slumber. Villages burn, livestock vanishes, and the king\'s armies have failed. A band of unlikely heroes — gathered at the last free tavern in the foothills — must climb the mountain, navigate its treacherous caverns, and confront the dragon before the entire realm is reduced to cinders. Ancient dwarven tunnels, enchanted forests, and a cunning dragon who speaks in riddles await.',
  },
  {
    title: 'Star Wanderers',
    tagline: 'Sci-fi exploration of a ghost ship',
    emoji: '\uD83D\uDE80',
    name: 'The Silent Meridian',
    worldSetting: 'The year is 3147. Your salvage crew aboard the tugship Penelope has picked up a distress beacon from the UES Meridian — a colony ship that vanished 80 years ago carrying 10,000 settlers. Now it drifts in the Oort Cloud, dark and silent. Scans show life support is active but no life signs. The ship\'s AI is still running, sending garbled warnings. Your crew needs the salvage money, but something went very wrong on the Meridian. Flickering lights, sealed bulkheads, and log entries that stop mid-sentence hint at a mystery that could change humanity\'s understanding of deep space.',
  },
  {
    title: 'Enchanted Academy',
    tagline: 'Magical school adventure for all ages',
    emoji: '\u2728',
    name: 'Secrets of Thornberry Academy',
    worldSetting: 'Thornberry Academy is a grand, sprawling school of magic hidden in an enchanted forest where the trees whisper and the hallways rearrange themselves on weekends. Students learn potion-brewing, creature-taming, and spell-weaving. But this semester, something strange is happening: paintings are going blank, the library books are rewriting themselves, and a mysterious door has appeared in the basement that no teacher will talk about. The headmaster has gone on an unexplained "sabbatical." It\'s up to a group of first-year students to uncover the secret before the whole academy unravels.',
  },
];

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

  const handleTemplateSelect = (template: AdventureTemplate) => {
    setLocalName(template.name);
    setLocalSetting(template.worldSetting);
  };

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
          {/* Quick-Start Templates */}
          <div className="space-y-2">
            <Label>Quick Start</Label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {ADVENTURE_TEMPLATES.map((template) => (
                <button
                  key={template.title}
                  type="button"
                  onClick={() => handleTemplateSelect(template)}
                  disabled={isGenerating}
                  className={`p-3 rounded-lg border text-left transition-all group ${
                    localName === template.name
                      ? 'border-primary bg-primary/10 ring-1 ring-primary'
                      : 'border-border hover:border-primary/50 hover:bg-primary/5'
                  }`}
                >
                  <div className="text-2xl mb-1">{template.emoji}</div>
                  <div className="font-medium text-sm group-hover:text-primary transition-colors">
                    {template.title}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {template.tagline}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">or describe your own</span>
            </div>
          </div>

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
