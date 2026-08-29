import source from "../examples/software-interview.mtree?raw";
import whoopSource from "../examples/whoop-android-interview.mtree?raw";
import { describe, expect, it } from "vitest";
import { blankProjectSource, playgroundPresets } from "../src/playground/presets";
import { compileMindTree } from "../src/scripting/compiler";

describe("compileMindTree", () => {
  it("compiles the example tree", () => {
    const result = compileMindTree(source);

    expect(result.diagnostics).toEqual([]);
    expect(result.document?.title).toBe("Software Engineering Interview");
    expect(result.document?.nodes.length).toBeGreaterThan(10);
    expect(result.document?.nodes.find((node) => node.id === "concise")?.priority).toBe("high");
  });

  it("compiles the WHOOP Android interview tree", () => {
    const result = compileMindTree(whoopSource);

    expect(result.diagnostics).toEqual([]);
    expect(result.document?.title).toBe("WHOOP Android Engineer Interview Simulation");
    expect(result.document?.view).toBe("tree");
    expect(result.document?.nodes.find((node) => node.id === "whoop_answer")?.answer).toContain("health data");
    expect(result.document?.nodes.find((node) => node.id === "whoop_engineering")?.kind).toBe("followup");
    expect(result.document?.nodes.find((node) => node.id === "success_question")?.kind).toBe("response");
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
      expect(result.document?.view).toBe(preset.id);
    }
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
