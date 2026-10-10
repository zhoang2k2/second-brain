'use client';

import React from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { Sun01Icon, Moon02Icon } from '@hugeicons/core-free-icons';
import { Theme } from './theme-store';

interface ThemeControlProps {
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
}

export const ThemeControl: React.FC<ThemeControlProps> = ({ theme, onThemeChange }) => {
  const isLight = theme === 'light';
  const isDark = theme === 'dark';

  return (
    <div
      role="group"
      aria-label="Theme selection"
      className="inline-flex items-center p-1 rounded-full border"
      style={{
        backgroundColor: 'var(--zhon-surface)',
        borderColor: 'var(--zhon-border)',
      }}
    >
      <button
        type="button"
        aria-pressed={isLight}
        onClick={() => onThemeChange('light')}
        className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-full cursor-pointer ${
          isLight
            ? 'font-semibold'
            : 'opacity-70 hover:opacity-100'
        }`}
        style={{
          backgroundColor: isLight ? 'var(--zhon-bg)' : 'transparent',
          color: isLight ? 'var(--zhon-text-primary)' : 'var(--zhon-text-secondary)',
        }}
      >
        <HugeiconsIcon
          icon={Sun01Icon}
          size={14}
          data-icon-source="hugeicons"
          className="hugeicons"
        />
        <span>Light</span>
      </button>

      <button
        type="button"
        aria-pressed={isDark}
        onClick={() => onThemeChange('dark')}
        className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-full cursor-pointer ${
          isDark
            ? 'font-semibold'
            : 'opacity-70 hover:opacity-100'
        }`}
        style={{
          backgroundColor: isDark ? 'var(--zhon-bg)' : 'transparent',
          color: isDark ? 'var(--zhon-text-primary)' : 'var(--zhon-text-secondary)',
        }}
      >
        <HugeiconsIcon
          icon={Moon02Icon}
          size={14}
          data-icon-source="hugeicons"
          className="hugeicons"
        />
        <span>Dark</span>
      </button>
    </div>
  );
};
