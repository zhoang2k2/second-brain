import { describe, expect, it } from "vitest";
import { getCitedSources } from "../lib/citations";

describe("chat source attribution", () => {
  const knowledge = [
    { path: "knowledge/lesson-one.md" },
    { path: "knowledge/lesson-two.md" },
  ];

  it("returns only retrieved paths explicitly cited in the answer", () => {
    expect(
      getCitedSources(
        "See [knowledge/lesson-two.md] for the saved explanation.",
        knowledge,
      ),
    ).toEqual(["knowledge/lesson-two.md"]);
  });

  it("recognizes exact retrieved paths written without brackets", () => {
    expect(
      getCitedSources("Source path: knowledge/lesson-two.md", knowledge),
    ).toEqual(["knowledge/lesson-two.md"]);
  });

  it("does not attribute retrieved notes when the model omits citations", () => {
    expect(getCitedSources("Here is a general answer.", knowledge)).toEqual([]);
  });

  it("ignores citations that were not among the retrieved notes", () => {
    expect(getCitedSources("See [knowledge/made-up.md].", knowledge)).toEqual(
      [],
    );
  });

  it("does not match only a prefix of a retrieved path", () => {
    expect(
      getCitedSources("See knowledge/lesson-one.md.backup.", knowledge),
    ).toEqual([]);
  });
});
