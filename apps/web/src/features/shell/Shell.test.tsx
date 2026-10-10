import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { Shell } from './Shell';

describe('Shell Component (UI v5 & Conventions)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sidebar_is_280px_desktop', () => {
    render(<Shell />);
    const sidebar = screen.getByRole('navigation', { name: /sidebar navigation/i });
    expect(sidebar).toBeInTheDocument();
    expect(sidebar).toHaveStyle({ width: '280px' });
    expect(sidebar.className).toContain('zhon-sidebar');
  });

  it('same_size_uppercase_groups', () => {
    render(<Shell />);
    const personalGroup = screen.getByRole('button', { name: 'PERSONAL' });
    const projectsGroup = screen.getByRole('button', { name: 'PROJECTS' });

    expect(personalGroup).toBeInTheDocument();
    expect(projectsGroup).toBeInTheDocument();

    // Verify uppercase text
    expect(personalGroup.textContent).toContain('PERSONAL');
    expect(projectsGroup.textContent).toContain('PROJECTS');

    // Verify same 14px font size
    expect(personalGroup).toHaveStyle({ fontSize: '14px' });
    expect(projectsGroup).toHaveStyle({ fontSize: '14px' });

    // Strict prohibition: No BOSS or Local labels anywhere in the shell
    expect(screen.queryByText(/boss/i)).toBeNull();
    expect(screen.queryByText(/\blocal\b/i)).toBeNull();
  });

  it('only_hugeicons', () => {
    const { container } = render(<Shell />);
    
    // Check all SVG icons have hugeicons attribution/class
    const svgs = container.querySelectorAll('svg');
    expect(svgs.length).toBeGreaterThan(0);
    svgs.forEach((svg) => {
      const isHugeicon = 
        svg.classList.contains('hugeicons') || 
        svg.getAttribute('data-icon-source') === 'hugeicons' ||
        svg.closest('[data-icon-source="hugeicons"]') !== null;
      expect(isHugeicon).toBe(true);
    });

    // Zero emojis in all text content
    const emojiRegex = /\p{Extended_Pictographic}/u;
    const allText = container.textContent || '';
    expect(emojiRegex.test(allText)).toBe(false);

    // No native browser disclosure arrows (<details> or <summary> without custom markers)
    const summaries = container.querySelectorAll('summary');
    expect(summaries.length).toBe(0);
  });

  it('group_keyboard_toggle', async () => {
    const user = userEvent.setup();
    render(<Shell />);

    const personalBtn = screen.getByRole('button', { name: 'PERSONAL' });
    expect(personalBtn).toHaveAttribute('aria-expanded', 'true');

    // Toggle with Enter key
    personalBtn.focus();
    await user.keyboard('{Enter}');
    expect(personalBtn).toHaveAttribute('aria-expanded', 'false');

    // Toggle back with Space key
    await user.keyboard(' ');
    expect(personalBtn).toHaveAttribute('aria-expanded', 'true');
  });

  it('reduced_motion_disables_transition', () => {
    // Mock matchMedia for prefers-reduced-motion
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    const { container } = render(<Shell />);
    const root = container.querySelector('[data-reduced-motion]');
    expect(root).toBeInTheDocument();
    expect(root).toHaveAttribute('data-reduced-motion', 'true');
  });

  it('selected_theme_persists', async () => {
    const user = userEvent.setup();
    render(<Shell />);

    const lightBtn = screen.getByRole('button', { name: 'Light', exact: true } as unknown as Parameters<typeof screen.getByRole>[1]);
    const darkBtn = screen.getByRole('button', { name: 'Dark', exact: true } as unknown as Parameters<typeof screen.getByRole>[1]);

    // Initial state: dark is default in Zhon UI v5
    expect(darkBtn).toHaveAttribute('aria-pressed', 'true');
    expect(lightBtn).toHaveAttribute('aria-pressed', 'false');

    // Switch to Light
    await user.click(lightBtn);
    expect(lightBtn).toHaveAttribute('aria-pressed', 'true');
    expect(darkBtn).toHaveAttribute('aria-pressed', 'false');
    expect(localStorage.getItem('zhon-theme')).toBe('light');

    // Switch back to Dark
    await user.click(darkBtn);
    expect(darkBtn).toHaveAttribute('aria-pressed', 'true');
    expect(lightBtn).toHaveAttribute('aria-pressed', 'false');
    expect(localStorage.getItem('zhon-theme')).toBe('dark');
  });

  it('verifies primary navigation and body-only footer', () => {
    render(<Shell />);

    // Primary nav items: Chats, Knowledge
    expect(screen.getByRole('button', { name: /chats/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /knowledge/i })).toBeInTheDocument();

    // Body-only footer inside workspace/main, not inside sidebar
    const footer = screen.getByRole('contentinfo');
    const sidebar = screen.getByRole('navigation', { name: /sidebar navigation/i });
    expect(sidebar.contains(footer)).toBe(false);

    // Neutral default conversation indicator, color reserved for active
    const activeItem = screen.getByRole('button', { name: /chats/i });
    expect(activeItem.querySelector('[data-indicator="active"]')).toBeInTheDocument();
  });
});
