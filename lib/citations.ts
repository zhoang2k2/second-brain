export const getCitedSources = (
  response: string,
  knowledge: { path: string }[],
): string[] =>
  knowledge
    .map((item) => item.path)
    .filter((source) => {
      const escapedSource = source.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return new RegExp(
        `(^|[^\\p{L}\\p{N}_./-])${escapedSource}(?=$|[^\\p{L}\\p{N}_./-])`,
        "u",
      ).test(response);
    });
