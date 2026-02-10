'use client';

import { useState } from 'react';
import { Loader2, Sparkles, RefreshCw, ArrowRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useSimpleGameStore } from '@/stores/simpleGameStore';
import { generateSimpleAttributes } from '@/lib/api';
import { TemplateSelector } from '@/components/campaign/TemplateSelector';
import { useActiveLocale } from '@/hooks/useActiveLocale';
import type { SimpleAttribute } from '@/lib/types';

export function GameSetup() {
  const t = useTranslations('simpleRpg.setup');
  const tTemplates = useTranslations('campaign.create.templates');
  const currentLocale = useActiveLocale();

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

  const handleTemplateSelect = (templateKey: string) => {
    setLocalName(tTemplates(`${templateKey}.name`));
    setLocalSetting(tTemplates(`${templateKey}.world`));
  };

  const handleGenerateAttributes = async () => {
    if (!localSetting.trim()) {
      setError(t('errors.settingRequired'));
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const response = await generateSimpleAttributes(localSetting, currentLocale);
      setAttributes(response.attributes);
      setAdventure(localName || t('untitledAdventure'), localSetting);
    } catch (err) {
      console.error('Failed to generate attributes:', err);
      setError(t('errors.generateFailed'));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleContinue = () => {
    if (attributes.length === 0) {
      setError(t('errors.attributesRequired'));
      return;
    }
    setAdventure(localName || t('untitledAdventure'), localSetting);
    advanceToPlayers();
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-500" />
            {t('title')}
          </CardTitle>
          <CardDescription>
            {t('description')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Quick-Start Templates */}
          <TemplateSelector
            onSelect={handleTemplateSelect}
            selectedName={localName}
            disabled={isGenerating}
          />

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">{t('orDescribeYourOwn')}</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="adventure-name">{t('adventureName')}</Label>
            <Input
              id="adventure-name"
              placeholder={t('adventureNamePlaceholder')}
              value={localName}
              onChange={(e) => setLocalName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="world-setting">{t('worldSetting')}</Label>
            <Textarea
              id="world-setting"
              placeholder={t('worldSettingPlaceholder')}
              value={localSetting}
              onChange={(e) => setLocalSetting(e.target.value)}
              className="min-h-[120px]"
            />
            <p className="text-xs text-muted-foreground">
              {t('worldSettingHint')}
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
                {t('creatingAdventure')}
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                {attributes.length > 0 ? t('regenerateAttributes') : t('createAdventure')}
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {attributes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t('characterAttributes')}</CardTitle>
            <CardDescription>
              {t('attributesDescription')}
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
                {t('regenerate')}
              </Button>
              <Button onClick={handleContinue} className="flex-1">
                {t('addPlayers')}
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
