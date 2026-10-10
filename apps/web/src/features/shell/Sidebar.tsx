'use client';

import React from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  ChatIcon,
  BookOpen01Icon,
  Settings01Icon,
  SidebarLeft01Icon,
} from '@hugeicons/core-free-icons';
import { ThemeControl } from './ThemeControl';
import { NavigationGroup } from './NavigationGroup';
import {
  ShellNavItemViewModel,
  ShellGroupViewModel,
  ViewType,
} from './view-model';
import { Theme } from './theme-store';

interface SidebarProps {
  primaryNav: ShellNavItemViewModel[];
  groups: ShellGroupViewModel[];
  theme: Theme;
  activeView: ViewType;
  isMobileOpen: boolean;
  onThemeChange: (theme: Theme) => void;
  onSelectNav: (view: ViewType) => void;
  onToggleGroup: (groupId: string) => void;
  onToggleMobile: () => void;
}

const NavIcon: React.FC<{ iconName: ShellNavItemViewModel['iconName'] }> = ({
  iconName,
}) => {
  switch (iconName) {
    case 'chats':
      return (
        <HugeiconsIcon
          icon={ChatIcon}
          size={16}
          data-icon-source="hugeicons"
          className="hugeicons mr-2.5 shrink-0"
        />
      );
    case 'knowledge':
      return (
        <HugeiconsIcon
          icon={BookOpen01Icon}
          size={16}
          data-icon-source="hugeicons"
          className="hugeicons mr-2.5 shrink-0"
        />
      );
    case 'settings':
      return (
        <HugeiconsIcon
          icon={Settings01Icon}
          size={16}
          data-icon-source="hugeicons"
          className="hugeicons mr-2.5 shrink-0"
        />
      );
    default:
      return null;
  }
};

export const Sidebar: React.FC<SidebarProps> = ({
  primaryNav,
  groups,
  theme,
  activeView,
  isMobileOpen,
  onThemeChange,
  onSelectNav,
  onToggleGroup,
  onToggleMobile,
}) => {
  return (
    <>
      {/* Mobile toggle button */}
      <button
        type="button"
        aria-label="Toggle navigation"
        aria-expanded={isMobileOpen}
        onClick={onToggleMobile}
        className="md:hidden fixed top-3 left-3 z-50 p-2 rounded-md border cursor-pointer"
        style={{
          backgroundColor: 'var(--zhon-surface)',
          borderColor: 'var(--zhon-border)',
          color: 'var(--zhon-text-primary)',
        }}
      >
        <HugeiconsIcon
          icon={SidebarLeft01Icon}
          size={18}
          data-icon-source="hugeicons"
          className="hugeicons"
        />
      </button>

      {/* Main Sidebar */}
      <nav
        role="navigation"
        aria-label="Sidebar navigation"
        className={`zhon-sidebar zhon-no-scrollbar flex flex-col justify-between shrink-0 h-full border-r ${
          isMobileOpen ? 'block' : 'hidden md:flex'
        }`}
        style={{
          width: '280px',
          minWidth: '280px',
          maxWidth: '280px',
          backgroundColor: 'var(--zhon-bg)',
          borderColor: 'var(--zhon-border)',
          color: 'var(--zhon-text-primary)',
        }}
      >
        {/* Top & Navigation Section */}
        <div className="flex flex-col flex-1 p-4 overflow-y-auto zhon-no-scrollbar">
          {/* Header */}
          <div className="flex items-center gap-2 mb-6 px-1">
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: 'var(--zhon-sky)' }}
            />
            <span className="font-bold text-sm tracking-wide">Zhon</span>
          </div>

          {/* Primary Navigation items */}
          <div className="space-y-1 mb-6">
            {primaryNav.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectNav(item.view)}
                className="flex items-center justify-between w-full px-3 py-2 text-sm font-medium rounded-lg transition-colors cursor-pointer"
                style={{
                  backgroundColor: item.isActive ? 'var(--zhon-surface)' : 'transparent',
                  color: item.isActive
                    ? 'var(--zhon-text-primary)'
                    : 'var(--zhon-text-secondary)',
                }}
              >
                <div className="flex items-center">
                  <NavIcon iconName={item.iconName} />
                  <span>{item.label}</span>
                </div>
                <span
                  data-indicator={item.isActive ? 'active' : 'neutral'}
                  className="w-1.5 h-1.5 rounded-full"
                  style={{
                    backgroundColor: item.isActive
                      ? 'var(--zhon-sky)'
                      : 'var(--zhon-indicator-neutral)',
                  }}
                />
              </button>
            ))}
          </div>

          {/* Scope Groups */}
          <div className="flex-1">
            {groups.map((group) => (
              <NavigationGroup
                key={group.id}
                group={group}
                onToggle={onToggleGroup}
              />
            ))}
          </div>
        </div>

        {/* Bottom Utilities */}
        <div
          className="p-4 border-t flex flex-col gap-3"
          style={{ borderColor: 'var(--zhon-border)' }}
        >
          <div className="flex items-center justify-between">
            <ThemeControl
              theme={theme}
              onThemeChange={onThemeChange}
            />

            <button
              type="button"
              aria-label="Settings"
              onClick={() => onSelectNav('settings')}
              className="p-1.5 rounded-md cursor-pointer hover:opacity-80 transition-opacity"
              style={{
                color: activeView === 'settings'
                  ? 'var(--zhon-sky)'
                  : 'var(--zhon-text-secondary)',
                backgroundColor: activeView === 'settings'
                  ? 'var(--zhon-surface)'
                  : 'transparent',
              }}
            >
              <HugeiconsIcon
                icon={Settings01Icon}
                size={18}
                data-icon-source="hugeicons"
                className="hugeicons"
              />
            </button>
          </div>
        </div>
      </nav>
    </>
  );
};
