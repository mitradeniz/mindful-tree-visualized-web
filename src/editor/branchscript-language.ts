import { completeFromList } from "@codemirror/autocomplete";
import { LRLanguage, LanguageSupport } from "@codemirror/language";
import { styleTags, tags } from "@lezer/highlight";
import { parser } from "../scripting/generated-parser";

const branchScriptParser = parser.configure({
  props: [
    styleTags({
      NodeKeyword: tags.keyword,
      Identifier: tags.variableName,
      String: tags.string,
      LineComment: tags.lineComment,
      '"tree"': tags.definitionKeyword,
      '"@"': tags.meta,
      '"->"': tags.operator,
    }),
  ],
});

export const branchScriptLanguage = LRLanguage.define({
  parser: branchScriptParser,
  languageData: {
    commentTokens: { line: "#" },
  },
});

const completions = completeFromList([
  { label: "tree", type: "keyword", detail: "document declaration" },
  { label: "diagram", type: "keyword", detail: "visual document declaration" },
  { label: "topic", type: "keyword", detail: "question group" },
  { label: "question", type: "keyword", detail: "incoming prompt" },
  { label: "response", type: "keyword", detail: "possible response" },
  { label: "followup", type: "keyword", detail: "likely next question" },
  { label: "note", type: "keyword", detail: "private reminder" },
  { label: "text", type: "keyword", detail: "free text block" },
  { label: "example", type: "keyword", detail: "supporting evidence" },
  { label: "input", type: "keyword", detail: "flow or network input" },
  { label: "layer", type: "keyword", detail: "network layer" },
  { label: "neuron", type: "keyword", detail: "neural activation" },
  { label: "process", type: "keyword", detail: "logic or workflow step" },
  { label: "decision", type: "keyword", detail: "branch condition" },
  { label: "outcome", type: "keyword", detail: "terminal result" },
  { label: "output", type: "keyword", detail: "network output" },
  { label: "step", type: "keyword", detail: "short for process" },
  { label: "choice", type: "keyword", detail: "short for decision" },
  { label: "result", type: "keyword", detail: "short for outcome" },
  { label: "start", type: "keyword", detail: "algorithm entry point" },
  { label: "function", type: "keyword", detail: "pseudocode function" },
  { label: "operation", type: "keyword", detail: "algorithm operation" },
  { label: "condition", type: "keyword", detail: "algorithm condition" },
  { label: "loop", type: "keyword", detail: "iteration step" },
  { label: "return", type: "keyword", detail: "algorithm result" },
  { label: "array", type: "keyword", detail: "indexed data container" },
  { label: "item", type: "keyword", detail: "data value or node" },
  { label: "stack", type: "keyword", detail: "last-in first-out structure" },
  { label: "queue", type: "keyword", detail: "first-in first-out structure" },
  { label: "list", type: "keyword", detail: "linked sequence" },
  { label: "record", type: "keyword", detail: "structured data value" },
  { label: "pointer", type: "keyword", detail: "data reference" },
  { label: "connect", type: "keyword", detail: "connect two named nodes" },
  { label: "@tag", type: "property", detail: "node tags" },
  { label: "@priority", type: "property", detail: "low, normal, or high" },
  { label: "@view", type: "property", detail: "tree, flow, neural, logic, algorithm, or data" },
  { label: "@font-scale", type: "property", detail: "global diagram text scale from 80 to 150" },
  { label: "@color", type: "property", detail: "green, blue, amber, purple, red, or gray" },
  { label: "@shape", type: "property", detail: "card, pill, diamond, or circle" },
  { label: "@status", type: "property", detail: "idea, active, done, or blocked" },
  { label: "@category", type: "property", detail: "quoted visual category shared by related nodes" },
  { label: "@width", type: "property", detail: "compact, normal, or wide" },
  { label: "@size", type: "property", detail: "exact quoted size, for example \"360x220\"" },
  { label: "@font", type: "property", detail: "sans, serif, or mono" },
  { label: "@font-size", type: "property", detail: "font size from 10 to 48" },
  { label: "@font-weight", type: "property", detail: "regular, medium, or bold" },
  { label: "@align", type: "property", detail: "left, center, or right" },
  { label: "@text", type: "property", detail: "supporting text shown inside the node" },
  { label: "@answer", type: "property", detail: "prepared interview answer" },
  { label: "@feature", type: "property", detail: "view-specific signal, rule, or property" },
  { label: "@items", type: "property", detail: "pipe-separated cells for arrays, stacks, queues, or lists" },
  { label: "@fields", type: "property", detail: "pipe-separated fields for records" },
]);

export function branchScript(): LanguageSupport {
  return new LanguageSupport(branchScriptLanguage, [
    branchScriptLanguage.data.of({ autocomplete: completions }),
  ]);
}
