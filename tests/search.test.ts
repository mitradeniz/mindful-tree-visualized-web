import { describe, expect, it } from "vitest";
import { matchingNodeIds, nodeMatchesSearch } from "../src/canvas/search";
import { compileMindTree } from "../src/scripting/compiler";

describe("canvas search", () => {
  const document = compileMindTree(`question intro "Tell me about yourself"
  @text "Open with recent backend work"
  @tag opening common
  @category "Opening"
  response concise "Concise introduction"
    @answer "I build reliable services."
    followup ownership "What did you own?"
      @feature "Probe: trade-offs"
question mvvm "Do you have experience with MVVM?"
  @text "Discuss architecture fundamentals"
record profile "Candidate profile"
  @fields "role = Android engineer | specialty = Kotlin specialist"`).document!;

  it("searches ids, labels, rich content, and tags", () => {
    expect(matchingNodeIds(document, "intro")).toEqual(["intro", "concise"]);
    expect(matchingNodeIds(document, "reliable")).toEqual(["concise"]);
    expect(matchingNodeIds(document, "trade-offs")).toEqual(["ownership"]);
    expect(matchingNodeIds(document, "common")).toEqual(["intro"]);
    expect(matchingNodeIds(document, "opening")).toEqual(["intro"]);
  });

  it("returns matches in stable document order for Enter-key cycling", () => {
    expect(matchingNodeIds(document, "i")).toEqual(["intro", "concise", "ownership", "mvvm", "profile"]);
    expect(nodeMatchesSearch(document.nodes[0]!, "BACKEND")).toBe(true);
    expect(matchingNodeIds(document, "")).toEqual([]);
  });

  it("requires every query word to match the same node", () => {
    expect(matchingNodeIds(document, "mvvm experience")[0]).toBe("mvvm");
    expect(matchingNodeIds(document, "architecture experience")[0]).toBe("mvvm");
    expect(matchingNodeIds(document, "backend experience")).toEqual([]);
    expect(matchingNodeIds(document, "backend kotlin")).toEqual([]);
    expect(matchingNodeIds(document, "reliable introduction")).toEqual(["concise"]);
  });

  it("accepts partial terms, transpositions, and small typing errors", () => {
    expect(matchingNodeIds(document, "experiance")).toContain("mvvm");
    expect(matchingNodeIds(document, "mvvm experince")).toEqual(["mvvm"]);
    expect(matchingNodeIds(document, "relable introducton")).toEqual(["concise"]);
    expect(matchingNodeIds(document, "adnroid kotlin")).toEqual(["profile"]);
    expect(matchingNodeIds(document, "kotlin")).toEqual(["profile"]);
  });

  it("normalizes punctuation and diacritics", () => {
    expect(matchingNodeIds(document, "trade offs")).toEqual(["ownership"]);
    expect(matchingNodeIds(document, "INTRODUCTION")).toEqual(["concise"]);
  });
});
