'use client';

import React from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowDown01Icon, ArrowRight01Icon } from '@hugeicons/core-free-icons';
import { ShellGroupViewModel, ShellGroupItemViewModel } from './view-model';

interface NavigationGroupProps {
  group: ShellGroupViewModel;
  onToggle: (groupId: string) => void;
  onSelectItem?: (itemId: string) => void;
}

const GroupItemRow: React.FC<{
  item: ShellGroupItemViewModel;
  onSelect?: (id: string) => void;
}> = ({ item, onSelect }) => {
  return (
    <button
      type="button"
      onClick={() => onSelect?.(item.id)}
      className="flex items-center w-full px-3 py-1.5 text-xs rounded-md transition-colors text-left cursor-pointer"
      style={{
        color: item.isActive ? 'var(--zhon-text-primary)' : 'var(--zhon-text-secondary)',
        backgroundColor: item.isActive ? 'var(--zhon-surface)' : 'transparent',
      }}
    >
      <span
        data-indicator={item.isActive ? 'active' : 'neutral'}
        className="w-1.5 h-1.5 rounded-full mr-2.5 shrink-0"
        style={{
          backgroundColor: item.isActive
            ? 'var(--zhon-sky)'
            : 'var(--zhon-indicator-neutral)',
        }}
      />
      <span className="truncate">{item.label}</span>
    </button>
  );
};

export const NavigationGroup: React.FC<NavigationGroupProps> = ({
  group,
  onToggle,
  onSelectItem,
}) => {
  const isExpanded = group.isExpanded;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onToggle(group.id);
    }
  };

  return (
    <div className="mb-4">
      <button
        type="button"
        aria-expanded={isExpanded}
        onClick={() => onToggle(group.id)}
        onKeyDown={handleKeyDown}
        className="flex items-center justify-between w-full px-2 py-1 text-left font-semibold tracking-wider cursor-pointer"
        style={{
          fontSize: '14px',
          color: 'var(--zhon-text-secondary)',
        }}
      >
        <span>{group.label}</span>
        <HugeiconsIcon
          icon={isExpanded ? ArrowDown01Icon : ArrowRight01Icon}
          size={14}
          data-icon-source="hugeicons"
          className="hugeicons shrink-0 opacity-70"
        />
      </button>

      {isExpanded && (
        <div className="mt-1 space-y-0.5 pl-1">
          {group.items.map((item) => (
            <GroupItemRow
              key={item.id}
              item={item}
              onSelect={onSelectItem}
            />
          ))}
        </div>
      )}
    </div>
  );
};
