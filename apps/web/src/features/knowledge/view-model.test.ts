import { describe, expect, it } from 'vitest';
import { sanitizeMarkdown, computeDiff } from './view-model';

describe('untrusted note rendering', () => {
  it('escapes all raw HTML including unquoted handlers and entity encoded links', () => {
    const untrusted = '<img src=x onerror=alert(1)><a href="java&#115;cript:alert(1)">link</a><svg onload=alert(1) />';
    const safe = sanitizeMarkdown(untrusted);
    expect(safe).not.toContain('<');
    expect(safe).toContain('&lt;img');
    expect(safe).toContain('java&amp;#115;cript');
  });

  it('bounds diff work for large valid Markdown files', () => {
    const old = Array.from({ length: 3000 }, (_, n) => `old ${n}`).join('\n');
    const replacement = Array.from({ length: 3000 }, (_, n) => `new ${n}`).join('\n');
    const diff = computeDiff(old, replacement);
    expect(diff.filter(line => line.type === 'added')).toHaveLength(3000);
    expect(diff.filter(line => line.type === 'removed')).toHaveLength(3000);
  });
});
