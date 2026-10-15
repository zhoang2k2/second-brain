export interface FrontmatterParseResult {
  ok: boolean;
  frontmatter: Record<string, string>;
  body: string;
  error?: string;
}

export function parseFrontmatter(content: string): FrontmatterParseResult {
  if (!content.startsWith('---')) {
    return { ok: true, frontmatter: {}, body: content };
  }

  const lines = content.split(/\r?\n/);
  if (lines[0].trim() !== '---') {
    return { ok: true, frontmatter: {}, body: content };
  }

  let closingIndex = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---' || lines[i].trim() === '...') {
      closingIndex = i;
      break;
    }
  }

  if (closingIndex === -1) {
    return { ok: false, frontmatter: {}, body: content, error: 'Unclosed frontmatter delimiter' };
  }

  const fmLines = lines.slice(1, closingIndex);
  const frontmatter: Record<string, string> = {};

  for (const line of fmLines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    // Check for malformed syntax (e.g. line starts with colon)
    if (trimmed.startsWith(':')) {
      return { ok: false, frontmatter: {}, body: content, error: 'Malformed YAML line: ' + line };
    }

    const colonIndex = trimmed.indexOf(':');
    if (colonIndex === -1) {
      return { ok: false, frontmatter: {}, body: content, error: 'Malformed YAML line missing colon: ' + line };
    }

    const key = trimmed.slice(0, colonIndex).trim();
    let value = trimmed.slice(colonIndex + 1).trim();

    if (!/^[A-Za-z_][A-Za-z0-9_-]*$/.test(key) || Object.hasOwn(frontmatter, key) || /^[\[\]{}|>&*!]/.test(value)) {
      return { ok: false, frontmatter: {}, body: content, error: 'Only unique flat scalar properties are supported' };
    }
    if ((value.startsWith('"') && !/^"(?:[^"\\]|\\.)*"$/.test(value)) ||
        (value.startsWith("'") && !/^'(?:[^']|'')*'$/.test(value)) ||
        (key === 'zhon_id' && !value)) {
      return { ok: false, frontmatter: {}, body: content, error: 'Incomplete property value' };
    }

    // Decode the supported flat scalar subset; comments never become identity bytes.
    if (value.startsWith('"')) {
      try { value = JSON.parse(value) as string; } catch {
        return { ok: false, frontmatter: {}, body: content, error: 'Unsupported quoted property escape' };
      }
    } else if (value.startsWith("'")) {
      value = value.slice(1, -1).replace(/''/g, "'");
    } else {
      value = value.replace(/\s+#.*$/, '').trim();
      if (/:\s/.test(value)) return { ok: false, frontmatter: {}, body: content, error: 'Nested property values are unsupported' };
    }
    if (key === 'zhon_id' && !value.trim()) return { ok: false, frontmatter: {}, body: content, error: 'Note identity must not be empty' };

    Object.defineProperty(frontmatter, key, { value, enumerable: true });
  }

  const body = lines.slice(closingIndex + 1).join('\n');
  return { ok: true, frontmatter, body };
}

