'use client';

import { useState } from 'react';
import { Check } from 'lucide-react';
import { Expert } from '@/data/experts';

interface ExpertCardProps {
  expert: Expert;
  isSelected: boolean;
  isRecommended: boolean;
  onToggle: () => void;
}

export function ExpertCard({ expert, isSelected, isRecommended, onToggle }: ExpertCardProps) {
  const [avatarError, setAvatarError] = useState(false);

  return (
    <button
      onClick={onToggle}
      className={`relative p-4 rounded-xl border transition-all text-left w-full ${
        isSelected
          ? 'border-ink bg-surface-sunken shadow-card'
          : 'border-hairline hover:border-hairline-strong bg-surface'
      }`}
    >
      {isRecommended && (
        <span className="absolute -top-2 -right-2 px-2 py-0.5 bg-sticker-yellow text-ink text-xs font-medium rounded-full">
          推荐
        </span>
      )}

      {isSelected && (
        <span className="absolute top-3 right-3 w-5 h-5 bg-ink rounded-full flex items-center justify-center">
          <Check size={12} className="text-paper" />
        </span>
      )}

      <div className="flex items-start gap-3">
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center text-paper font-bold text-lg overflow-hidden"
          style={{ backgroundColor: expert.color }}
        >
          {expert.avatar && !avatarError ? (
            <img
              src={expert.avatar}
              alt={expert.name}
              className="w-full h-full object-cover"
              onError={() => setAvatarError(true)}
            />
          ) : (
            expert.name.charAt(0)
          )}
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-ink">{expert.name}</h3>
          <p className="text-sm text-ink-muted truncate">{expert.title}</p>
        </div>
      </div>

      <p className="mt-3 text-xs text-ink-faint line-clamp-2">
        {expert.description}
      </p>

      <div className="mt-3 flex flex-wrap gap-1">
        {expert.expertise.slice(0, 2).map((item) => (
          <span
            key={item}
            className="px-2 py-0.5 bg-surface-sunken text-ink-secondary text-xs rounded-full"
          >
            {item}
          </span>
        ))}
      </div>
    </button>
  );
}
