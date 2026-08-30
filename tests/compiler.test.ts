import source from "../examples/software-interview.mtree?raw";
import { describe, expect, it } from "vitest";
import { blankProjectSource, playgroundPresets, presetsForView } from "../src/playground/presets";
import { compileMindTree } from "../src/scripting/compiler";

describe("compileMindTree", () => {
  it("compiles the example tree", () => {
    const result = compileMindTree(source);

    expect(result.diagnostics).toEqual([]);
    expect(result.document?.title).toBe("Software Engineering Interview");
    expect(result.document?.nodes.length).toBeGreaterThan(10);
    expect(result.document?.nodes.find((node) => node.id === "concise")?.priority).toBe("high");
  });

  it("reports duplicate identifiers", () => {
    const result = compileMindTree(`question intro "One"\nquestion intro "Two"`);

    expect(result.document).toBeUndefined();
    expect(result.diagnostics[0]?.message).toContain("Duplicate node id");
  });

  it("reports invalid indentation", () => {
    const result = compileMindTree(`question intro "One"\n response answer "Two"`);

    expect(result.document).toBeUndefined();
    expect(result.diagnostics.some((item) => item.message.includes("multiples of two"))).toBe(true);
  });

  it("supports Unicode text", () => {
    const result = compileMindTree(`question giris "Kendinden bahseder misin?"\n  response kisa "Ölçülebilir sonuçlarla anlatırım."`);

    expect(result.diagnostics).toEqual([]);
    expect(result.document?.nodes[1]?.label).toBe("Ölçülebilir sonuçlarla anlatırım.");
  });

  it("reports unknown references", () => {
    const result = compileMindTree(`question intro "One"\n  response answer "Two"\n    -> missing`);

    expect(result.document).toBeUndefined();
    expect(result.diagnostics.some((item) => item.message.includes("Unknown reference target"))).toBe(true);
  });

  it("rejects cyclic references", () => {
    const result = compileMindTree(`question first "One"\n  response second "Two"\n    -> first`);

    expect(result.document).toBeUndefined();
    expect(result.diagnostics.some((item) => item.message.includes("cycle"))).toBe(true);
  });

  it("compiles every playground preset", () => {
    for (const preset of playgroundPresets) {
      const result = compileMindTree(preset.source);
      expect(result.diagnostics, preset.id).toEqual([]);
      expect(result.document?.view).toBe(preset.view);
    }
  });

  it("offers several real-world templates for technical visual languages", () => {
    for (const view of ["data", "algorithm", "logic", "neural"] as const) {
      expect(presetsForView(view).length, view).toBeGreaterThanOrEqual(3);
      expect(presetsForView(view).length, view).toBeLessThanOrEqual(5);
    }
    expect(playgroundPresets.some((preset) => preset.id === "logic-scientific-calculator")).toBe(true);
    expect(playgroundPresets.some((preset) => preset.id === "data-lru-cache")).toBe(true);
    expect(playgroundPresets.some((preset) => preset.id === "algorithm-dijkstra")).toBe(true);
    expect(playgroundPresets.some((preset) => preset.id === "neural-image-classifier")).toBe(true);
  });

  it("accepts an explicitly declared blank project", () => {
    const result = compileMindTree(blankProjectSource);

    expect(result.diagnostics).toEqual([]);
    expect(result.document).toMatchObject({ id: "untitled", title: "Untitled", view: "tree", nodes: [] });
  });

  it("preserves connection labels", () => {
    const result = compileMindTree(`diagram logic "Logic"\n@view logic\ninput start "Start"\noutcome done "Done"\nconnect start -> done "yes"`);

    expect(result.diagnostics).toEqual([]);
    expect(result.document?.edges[0]?.label).toBe("yes");
  });

  it("allows workflow loops but rejects neural cycles", () => {
    const flow = compileMindTree(`diagram loop "Loop"\n@view flow\nprocess first "First"\nprocess second "Second"\nconnect first -> second\nconnect second -> first`);
    const neural = compileMindTree(`diagram loop "Loop"\n@view neural\nneuron first "First"\nneuron second "Second"\nconnect first -> second\nconnect second -> first`);

    expect(flow.document).toBeDefined();
    expect(neural.document).toBeUndefined();
    expect(neural.diagnostics.some((item) => item.message.includes("must not contain cycles"))).toBe(true);
  });

  it("supports practical aliases and visual attributes", () => {
    const result = compileMindTree(`diagram quick "Quick flow"
@view flow
step draft "Draft the answer"
  @color green
  @shape pill
  @status active
choice review "Is it clear?"
result ready "Use the answer"
connect draft -> review
connect review -> ready "yes"`);

    expect(result.diagnostics).toEqual([]);
    expect(result.document?.nodes[0]).toMatchObject({
      kind: "process",
      color: "green",
      shape: "pill",
      status: "active",
    });
    expect(result.document?.nodes[1]?.kind).toBe("decision");
    expect(result.document?.nodes[2]?.kind).toBe("outcome");
  });

  it("reports invalid visual attributes", () => {
    const result = compileMindTree(`process draft "Draft"
  @color orange
  @shape hexagon
  @status waiting`);

    expect(result.document).toBeUndefined();
    expect(result.diagnostics).toHaveLength(3);
  });

  it("compiles rich node content for interview recall", () => {
    const result = compileMindTree(`question ownership "What did you own?"
  @text "Clarify personal scope."
  @answer "I owned the API contract and rollout."
  @feature "Follow-up: explain a trade-off"`);

    expect(result.diagnostics).toEqual([]);
    expect(result.document?.nodes[0]).toMatchObject({
      text: "Clarify personal scope.",
      answer: "I owned the API contract and rollout.",
      feature: "Follow-up: explain a trade-off",
    });
    expect(result.document?.nodes[0]?.source.to.line).toBe(4);
  });

  it("compiles free text blocks with typography settings", () => {
    const result = compileMindTree(`text reminder "Pause before answering"
  @text "Take one breath, then lead with the result."
  @font serif
  @font-size 28
  @font-weight bold
  @align center`);

    expect(result.diagnostics).toEqual([]);
    expect(result.document?.nodes[0]).toMatchObject({
      kind: "text",
      label: "Pause before answering",
      text: "Take one breath, then lead with the result.",
      fontFamily: "serif",
      fontSize: 28,
      fontWeight: "bold",
      textAlign: "center",
    });
  });

  it("compiles a diagram-wide font scale", () => {
    const result = compileMindTree(`diagram readable "Readable"
@view tree
@font-scale 130
question intro "Tell me about yourself"`);

    expect(result.diagnostics).toEqual([]);
    expect(result.document?.fontScale).toBe(130);
  });

  it("rejects invalid global font scales", () => {
    const result = compileMindTree(`diagram readable "Readable"
@font-scale 300
question intro "Tell me about yourself"
  @font-scale 120`);

    expect(result.document).toBeUndefined();
    expect(result.diagnostics).toHaveLength(2);
  });

  it("reports invalid typography settings", () => {
    const result = compileMindTree(`text reminder "Reminder"
  @font display
  @font-size 128
  @font-weight heavy
  @align justify`);

    expect(result.document).toBeUndefined();
    expect(result.diagnostics).toHaveLength(4);
  });

  it("compiles visual categories and card width presets", () => {
    const result = compileMindTree(`question project "Describe a difficult project"
  @category "Behavioral"
  @width wide`);

    expect(result.diagnostics).toEqual([]);
    expect(result.document?.nodes[0]).toMatchObject({ category: "Behavioral", width: "wide" });
  });

  it("rejects invalid visual category and width values", () => {
    const result = compileMindTree(`question project "Describe a difficult project"
  @category unquoted
  @width enormous`);

    expect(result.document).toBeUndefined();
    expect(result.diagnostics).toHaveLength(2);
  });

  it("compiles exact box dimensions written by canvas resizing", () => {
    const result = compileMindTree(`question project "Describe a difficult project"
  @size "420x240"`);

    expect(result.diagnostics).toEqual([]);
    expect(result.document?.nodes[0]).toMatchObject({ boxWidth: 420, boxHeight: 240 });
  });

  it("rejects malformed or unsafe box dimensions", () => {
    const result = compileMindTree(`question first "One"
  @size "100x40"
question second "Two"
  @size "not-a-size"`);

    expect(result.document).toBeUndefined();
    expect(result.diagnostics).toHaveLength(2);
  });

  it("compiles structured data cells and record fields", () => {
    const result = compileMindTree(`diagram data "Data"
@view data
array scores "Scores"
  @items "8 | 3 | 5 | 1"
record user "User"
  @fields "id = 42 | name = Ada"
connect scores -> user`);

    expect(result.diagnostics).toEqual([]);
    expect(result.document?.nodes[0]?.items).toEqual(["8", "3", "5", "1"]);
    expect(result.document?.nodes[1]?.fields).toEqual(["id = 42", "name = Ada"]);
  });

  it("requires quoted content attributes", () => {
    const result = compileMindTree(`question ownership "What did you own?"
  @answer unquoted answer`);

    expect(result.document).toBeUndefined();
    expect(result.diagnostics[0]?.message).toContain("quoted text");
  });

  it("limits untrusted source and rich content sizes", () => {
    const oversizedSource = compileMindTree("x".repeat(1_000_001));
    const oversizedAnswer = compileMindTree(`question answer "Answer"
  @answer "${"a".repeat(601)}"`);

    expect(oversizedSource.document).toBeUndefined();
    expect(oversizedSource.diagnostics[0]?.message).toContain("1,000,000");
    expect(oversizedAnswer.document).toBeUndefined();
    expect(oversizedAnswer.diagnostics[0]?.message).toContain("too long");
  });
});
