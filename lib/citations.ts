export const getCitedSources = (
  response: string,
  knowledge: { path: string }[],
): string[] =>
  knowledge
    .map((item) => item.path)
    .filter((source) => response.includes(`[${source}]`));
