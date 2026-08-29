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
      @feature "Probe: trade-offs"`).document!;

  it("searches ids, labels, rich content, and tags", () => {
    expect(matchingNodeIds(document, "intro")).toEqual(["intro", "concise"]);
    expect(matchingNodeIds(document, "reliable")).toEqual(["concise"]);
    expect(matchingNodeIds(document, "trade-offs")).toEqual(["ownership"]);
    expect(matchingNodeIds(document, "common")).toEqual(["intro"]);
    expect(matchingNodeIds(document, "opening")).toEqual(["intro"]);
  });

  it("returns matches in stable document order for Enter-key cycling", () => {
    expect(matchingNodeIds(document, "i")).toEqual(["intro", "concise", "ownership"]);
    expect(nodeMatchesSearch(document.nodes[0]!, "BACKEND")).toBe(true);
    expect(matchingNodeIds(document, "")).toEqual([]);
  });
});
