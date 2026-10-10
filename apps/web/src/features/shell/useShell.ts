'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { getStoredTheme, setStoredTheme, Theme } from './theme-store';
import {
  ViewType,
  ShellNavItemViewModel,
  ShellGroupViewModel,
  createPrimaryNavViewModels,
  createGroupViewModels,
} from './view-model';

export function useShell(initialView: ViewType = 'chats') {
  const [theme, setThemeState] = useState<Theme>(() => getStoredTheme());
  const [activeView, setActiveView] = useState<ViewType>(initialView);
  const [selectedItemId, setSelectedItemId] = useState<string>('chats');
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    personal: true,
    projects: true,
  });
  const [reducedMotion, setReducedMotion] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      try {
        return Boolean(window.matchMedia('(prefers-reduced-motion: reduce)')?.matches);
      } catch {
        return false;
      }
    }
    return false;
  });
  const [isMobileOpen, setIsMobileOpen] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      try {
        const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
        if (mediaQuery) {
          const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
          if (mediaQuery.addEventListener) {
            mediaQuery.addEventListener('change', handler);
            return () => mediaQuery.removeEventListener('change', handler);
          } else if (mediaQuery.addListener) {
            mediaQuery.addListener(handler);
            return () => mediaQuery.removeListener(handler);
          }
        }
      } catch {
        // Fall back gracefully in environments without matchMedia
      }
    }
  }, []);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', theme);
    }
  }, [theme]);

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
    setStoredTheme(newTheme);
  }, []);

  const setView = useCallback((newView: ViewType) => {
    setActiveView(newView);
    setSelectedItemId(newView);
  }, []);

  const toggleGroup = useCallback((groupId: string) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [groupId]: prev[groupId] === false,
    }));
  }, []);

  const toggleMobileOpen = useCallback(() => {
    setIsMobileOpen((prev) => !prev);
  }, []);

  const primaryNav = useMemo<ShellNavItemViewModel[]>(() => {
    return createPrimaryNavViewModels(activeView);
  }, [activeView]);

  const groups = useMemo<ShellGroupViewModel[]>(() => {
    return createGroupViewModels({
      activeView,
      selectedItemId,
      expandedGroups,
    });
  }, [activeView, selectedItemId, expandedGroups]);

  return {
    theme,
    activeView,
    groups,
    primaryNav,
    reducedMotion,
    isMobileOpen,
    setTheme,
    setView,
    toggleGroup,
    toggleMobileOpen,
  };
}
