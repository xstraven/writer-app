'use client';

import { useTranslations } from 'next-intl';
import { Label } from '@/components/ui/label';

interface Template {
  key: string;
  emoji: string;
}

const TEMPLATES: Template[] = [
  {
    key: 'dragonsPeak',
    emoji: '🐉',
  },
  {
    key: 'starWanderers',
    emoji: '🚀',
  },
  {
    key: 'enchantedAcademy',
    emoji: '✨',
  },
];

interface TemplateSelectorProps {
  onSelect: (templateKey: string) => void;
  selectedName?: string;
  disabled?: boolean;
  showLabel?: boolean;
}

export function TemplateSelector({
  onSelect,
  selectedName,
  disabled = false,
  showLabel = true
}: TemplateSelectorProps) {
  const t = useTranslations('campaign.create.templates');
  const tSetup = useTranslations('simpleRpg.setup');

  return (
    <div className="space-y-2">
      {showLabel && <Label>{tSetup('quickStart')}</Label>}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {TEMPLATES.map((template) => {
          const templateName = t(`${template.key}.name`);
          const isSelected = selectedName === templateName;

          return (
            <button
              key={template.key}
              type="button"
              onClick={() => onSelect(template.key)}
              disabled={disabled}
              className={`p-3 rounded-lg border text-left transition-all group ${
                isSelected
                  ? 'border-primary bg-primary/10 ring-1 ring-primary'
                  : 'border-border hover:border-primary/50 hover:bg-primary/5'
              }`}
            >
              <div className="text-2xl mb-1">{template.emoji}</div>
              <div className="font-medium text-sm group-hover:text-primary transition-colors">
                {t(`${template.key}.title`)}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {t(`${template.key}.tagline`)}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
