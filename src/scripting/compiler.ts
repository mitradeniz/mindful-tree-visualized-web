import type {
  GraphDocument,
  GraphEdge,
  GraphNode,
  DiagramView,
  NodeColor,
  NodeKind,
  NodeShape,
  NodeStatus,
  Priority,
  SourceSpan,
} from "../domain/graph-document";
import {
  diagramViews,
  graphDocumentSchema,
  nodeColors,
  nodeKinds,
  nodeShapes,
  nodeStatuses,
  priorities,
} from "../domain/graph-document";
import type { Diagnostic } from "./diagnostic";
import { parser as syntaxParser } from "./generated-parser";

export interface CompileResult {
  document?: GraphDocument;
  diagnostics: Diagnostic[];
}

interface StackEntry {
  indent: number;
  node: GraphNode;
}

interface PendingReference {
  source: string;
  target: string;
  line: number;
  column: number;
  from: number;
  to: number;
}

interface PendingConnection extends PendingReference {
  label?: string;
}

const statementPattern = /^(tree|diagram|topic|question|response|followup|note|example|input|layer|neuron|process|decision|outcome|output|step|choice|result|start|function|operation|condition|loop|return|array|item|stack|queue|list|record|pointer)\s+([A-Za-z][\w-]*)\s+"((?:[^"\\]|\\.)*)"\s*$/;
const attributePattern = /^@(tag|priority|view|color|shape|status|text|answer|feature|items|fields)\s+(.+?)\s*$/;
const referencePattern = /^->\s+([A-Za-z][\w-]*)\s*$/;
const connectionPattern = /^connect\s+([A-Za-z][\w-]*)\s+->\s+([A-Za-z][\w-]*)(?:\s+"((?:[^"\\]|\\.)*)")?\s*$/;
const nodeKindSet = new Set<string>(nodeKinds);
const prioritySet = new Set<string>(priorities);
const diagramViewSet = new Set<string>(diagramViews);
const nodeColorSet = new Set<string>(nodeColors);
const nodeShapeSet = new Set<string>(nodeShapes);
const nodeStatusSet = new Set<string>(nodeStatuses);
const maxSourceLength = 1_000_000;
const maxNodes = 2_000;
const maxEdges = 5_000;
const maxLabelLength = 160;
const maxConnectionLabelLength = 80;
const maxContentLengths = { text: 420, answer: 600, feature: 120 } as const;
const maxDataValueLength = 80;
const kindAliases: Record<string, NodeKind> = {
  step: "process",
  choice: "decision",
  result: "outcome",
};

const allowedChildren: Record<NodeKind, ReadonlySet<NodeKind>> = {
  topic: new Set(["question", "process", "decision", "note", "example"]),
  question: new Set(["response", "note", "example"]),
  response: new Set(["followup", "process", "decision", "outcome", "note", "example"]),
  followup: new Set(["response", "note", "example"]),
  note: new Set(),
  example: new Set(),
  input: new Set(["layer", "neuron", "process"]),
  layer: new Set(["layer", "neuron", "output"]),
  neuron: new Set(["neuron", "output"]),
  process: new Set(["process", "decision", "outcome", "note", "example"]),
  decision: new Set(["process", "decision", "outcome"]),
  outcome: new Set(["note", "example"]),
  output: new Set(["note", "example"]),
  start: new Set(["function", "operation", "condition", "loop", "return"]),
  function: new Set(["operation", "condition", "loop", "return", "note"]),
  operation: new Set(["operation", "condition", "loop", "return", "note"]),
  condition: new Set(["operation", "condition", "loop", "return"]),
  loop: new Set(["operation", "condition", "loop", "return"]),
  return: new Set(["note"]),
  array: new Set(["item", "pointer", "note"]),
  item: new Set(["item", "pointer", "note"]),
  stack: new Set(["item", "pointer", "note"]),
  queue: new Set(["item", "pointer", "note"]),
  list: new Set(["item", "pointer", "note"]),
  record: new Set(["item", "pointer", "note"]),
  pointer: new Set(["item", "record", "note"]),
};

function lineOffsets(source: string): number[] {
  const offsets = [0];
  for (let index = 0; index < source.length; index += 1) {
    if (source[index] === "\n") offsets.push(index + 1);
  }
  return offsets;
}

function spanForLine(offset: number, line: number, rawLine: string): SourceSpan {
  return {
    from: { offset, line, column: 1 },
    to: { offset: offset + rawLine.length, line, column: rawLine.length + 1 },
  };
}

function diagnostic(
  message: string,
  line: number,
  column: number,
  from: number,
  to: number,
  severity: Diagnostic["severity"] = "error",
): Diagnostic {
  return { message, line, column, from, to, severity };
}

function decodeText(value: string): string | undefined {
  try {
    return JSON.parse(`"${value}"`) as string;
  } catch {
    return undefined;
  }
}

function decodeAttributeText(value: string): string | undefined {
  const match = /^"((?:[^"\\]|\\.)*)"$/.exec(value);
  return match ? decodeText(match[1] ?? "") : undefined;
}

function hasCycle(nodes: GraphNode[], edges: GraphEdge[]): boolean {
  const outgoing = new Map<string, string[]>();
  for (const node of nodes) outgoing.set(node.id, []);
  for (const edge of edges) outgoing.get(edge.source)?.push(edge.target);

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (id: string): boolean => {
    if (visiting.has(id)) return true;
    if (visited.has(id)) return false;
    visiting.add(id);
    for (const target of outgoing.get(id) ?? []) {
      if (visit(target)) return true;
    }
    visiting.delete(id);
    visited.add(id);
    return false;
  };

  return nodes.some((node) => visit(node.id));
}

export function compileMindTree(source: string): CompileResult {
  if (source.length > maxSourceLength) {
    return {
      diagnostics: [
        diagnostic("BranchScript source must be 1,000,000 characters or smaller.", 1, 1, 0, 1),
      ],
    };
  }
  syntaxParser.parse(source);

  const diagnostics: Diagnostic[] = [];
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const references: PendingReference[] = [];
  const connections: PendingConnection[] = [];
  const identifiers = new Set<string>();
  const stack: StackEntry[] = [];
  const lines = source.split(/\r?\n/);
  const offsets = lineOffsets(source);
  let documentId = "branchscript-project";
  let title = "Untitled BranchScript";
  let treeSeen = false;
  let view: DiagramView = "tree";

  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = lines[index] ?? "";
    const lineNumber = index + 1;
    const offset = offsets[index] ?? 0;
    const contentStart = rawLine.search(/\S/);

    if (contentStart === -1 || rawLine.slice(contentStart).startsWith("#")) continue;

    const leading = rawLine.slice(0, contentStart);
    if (leading.includes("\t")) {
      diagnostics.push(
        diagnostic("Indentation must use spaces, not tabs.", lineNumber, 1, offset, offset + contentStart),
      );
      continue;
    }

    const indent = leading.length;
    const content = rawLine.slice(contentStart);
    if (indent % 2 !== 0) {
      diagnostics.push(
        diagnostic(
          "Indentation must use multiples of two spaces.",
          lineNumber,
          1,
          offset,
          offset + contentStart,
        ),
      );
    }

    while ((stack.at(-1)?.indent ?? -1) >= indent) stack.pop();
    const parent = stack.at(-1);

    const statement = statementPattern.exec(content);
    if (statement) {
      const keyword = statement[1] ?? "";
      const id = statement[2] ?? "";
      const rawLabel = statement[3] ?? "";
      const label = decodeText(rawLabel);

      if (label === undefined) {
        diagnostics.push(
          diagnostic(
            "The quoted text contains an invalid escape sequence.",
            lineNumber,
            contentStart + 1,
            offset + contentStart,
            offset + rawLine.length,
          ),
        );
        continue;
      }
      if (label.length > maxLabelLength) {
        diagnostics.push(
          diagnostic("Node and diagram titles must be 160 characters or smaller.", lineNumber, contentStart + 1, offset + contentStart, offset + rawLine.length),
        );
        continue;
      }

      if (keyword === "tree" || keyword === "diagram") {
        if (indent !== 0) {
          diagnostics.push(
            diagnostic("The tree declaration must not be indented.", lineNumber, 1, offset, offset + rawLine.length),
          );
        }
        if (treeSeen) {
          diagnostics.push(
            diagnostic("Only one tree declaration is allowed.", lineNumber, 1, offset, offset + rawLine.length),
          );
        } else {
          treeSeen = true;
          documentId = id;
          title = label;
        }
        continue;
      }

      const normalizedKeyword = kindAliases[keyword] ?? keyword;
      if (!nodeKindSet.has(normalizedKeyword)) continue;
      const kind = normalizedKeyword as NodeKind;
      if (nodes.length >= maxNodes) {
        diagnostics.push(
          diagnostic("A BranchScript document can contain at most 2,000 nodes.", lineNumber, contentStart + 1, offset + contentStart, offset + rawLine.length),
        );
        continue;
      }
      if (identifiers.has(id)) {
        diagnostics.push(
          diagnostic(`Duplicate node id: ${id}.`, lineNumber, contentStart + 1, offset + contentStart, offset + rawLine.length),
        );
        continue;
      }

      if (!parent && indent !== 0) {
        diagnostics.push(
          diagnostic("This node has no parent at the previous indentation level.", lineNumber, 1, offset, offset + contentStart),
        );
      }
      if (parent && indent !== parent.indent + 2) {
        diagnostics.push(
          diagnostic("Each child level must add exactly two spaces.", lineNumber, 1, offset, offset + contentStart),
        );
      }
      if (parent && !allowedChildren[parent.node.kind].has(kind)) {
        diagnostics.push(
          diagnostic(
            `${kind} cannot be nested under ${parent.node.kind}.`,
            lineNumber,
            contentStart + 1,
            offset + contentStart,
            offset + rawLine.length,
          ),
        );
      }

      const node: GraphNode = {
        id,
        kind,
        label,
        tags: [],
        priority: "normal",
        source: spanForLine(offset, lineNumber, rawLine),
        ...(parent ? { parentId: parent.node.id } : {}),
      };
      nodes.push(node);
      identifiers.add(id);
      if (parent) {
        edges.push({
          id: `branch:${parent.node.id}:${id}`,
          source: parent.node.id,
          target: id,
          kind: "branch",
        });
      }
      stack.push({ indent, node });
      continue;
    }

    const attribute = attributePattern.exec(content);
    if (attribute) {
      const owner = parent;
      const name = attribute[1] ?? "";
      const value = attribute[2] ?? "";
      if (name === "view") {
        if (indent !== 0 || owner) {
          diagnostics.push(
            diagnostic("The view setting must be unindented.", lineNumber, 1, offset, offset + rawLine.length),
          );
        } else if (!diagramViewSet.has(value)) {
          diagnostics.push(
            diagnostic("View must be tree, flow, neural, logic, algorithm, or data.", lineNumber, contentStart + 1, offset + contentStart, offset + rawLine.length),
          );
        } else {
          view = value as DiagramView;
        }
        continue;
      }
      if (!owner || indent !== owner.indent + 2) {
        diagnostics.push(
          diagnostic("Attributes must be indented directly below a node.", lineNumber, 1, offset, offset + rawLine.length),
        );
        continue;
      }
      owner.node.source.to = spanForLine(offset, lineNumber, rawLine).to;
      if (name === "tag") {
        const tags = value.split(/\s+/).filter(Boolean);
        if (tags.length > 20 || tags.some((tag) => tag.length > 40)) {
          diagnostics.push(
            diagnostic("Use at most 20 tags of 40 characters each.", lineNumber, contentStart + 1, offset + contentStart, offset + rawLine.length),
          );
        } else {
          owner.node.tags.push(...tags.filter((tag) => !owner.node.tags.includes(tag)));
        }
      } else if (name === "priority") {
        if (!prioritySet.has(value)) {
          diagnostics.push(
            diagnostic("Priority must be low, normal, or high.", lineNumber, contentStart + 1, offset + contentStart, offset + rawLine.length),
          );
        } else {
          owner.node.priority = value as Priority;
        }
      } else if (name === "color") {
        if (!nodeColorSet.has(value)) {
          diagnostics.push(
            diagnostic("Color must be green, blue, amber, purple, red, or gray.", lineNumber, contentStart + 1, offset + contentStart, offset + rawLine.length),
          );
        } else {
          owner.node.color = value as NodeColor;
        }
      } else if (name === "shape") {
        if (!nodeShapeSet.has(value)) {
          diagnostics.push(
            diagnostic("Shape must be card, pill, diamond, or circle.", lineNumber, contentStart + 1, offset + contentStart, offset + rawLine.length),
          );
        } else {
          owner.node.shape = value as NodeShape;
        }
      } else if (name === "status") {
        if (!nodeStatusSet.has(value)) {
          diagnostics.push(
            diagnostic("Status must be idea, active, done, or blocked.", lineNumber, contentStart + 1, offset + contentStart, offset + rawLine.length),
          );
        } else {
          owner.node.status = value as NodeStatus;
        }
      } else if (name === "text" || name === "answer" || name === "feature") {
        const decoded = decodeAttributeText(value);
        if (!decoded) {
          diagnostics.push(
            diagnostic(
              `${name} must contain non-empty quoted text.`,
              lineNumber,
              contentStart + 1,
              offset + contentStart,
              offset + rawLine.length,
            ),
          );
        } else if (decoded.length > maxContentLengths[name]) {
          diagnostics.push(
            diagnostic(`${name} is too long.`, lineNumber, contentStart + 1, offset + contentStart, offset + rawLine.length),
          );
        } else {
          owner.node[name] = decoded;
        }
      } else if (name === "items" || name === "fields") {
        const decoded = decodeAttributeText(value);
        const values = decoded
          ?.split("|")
          .map((item) => item.trim())
          .filter(Boolean);
        if (!values || values.length === 0 || values.length > 8 || values.some((item) => item.length > maxDataValueLength)) {
          diagnostics.push(
            diagnostic(`${name} must contain 1–8 values separated with |.`, lineNumber, contentStart + 1, offset + contentStart, offset + rawLine.length),
          );
        } else if (name === "items") {
          owner.node.items = values;
        } else {
          owner.node.fields = values;
        }
      }
      continue;
    }

    const connection = connectionPattern.exec(content);
    if (connection) {
      if (indent !== 0) {
        diagnostics.push(
          diagnostic("Connect statements must not be indented.", lineNumber, 1, offset, offset + rawLine.length),
        );
        continue;
      }
      const rawConnectionLabel = connection[3];
      const decodedLabel = rawConnectionLabel === undefined ? undefined : decodeText(rawConnectionLabel);
      if (rawConnectionLabel !== undefined && decodedLabel === undefined) {
        diagnostics.push(
          diagnostic("The connection label contains an invalid escape sequence.", lineNumber, contentStart + 1, offset + contentStart, offset + rawLine.length),
        );
        continue;
      }
      if (decodedLabel && decodedLabel.length > maxConnectionLabelLength) {
        diagnostics.push(
          diagnostic("Connection labels must be 80 characters or smaller.", lineNumber, contentStart + 1, offset + contentStart, offset + rawLine.length),
        );
        continue;
      }
      if (edges.length + connections.length + references.length >= maxEdges) {
        diagnostics.push(
          diagnostic("A BranchScript document can contain at most 5,000 connections.", lineNumber, contentStart + 1, offset + contentStart, offset + rawLine.length),
        );
        continue;
      }
      connections.push({
        source: connection[1] ?? "",
        target: connection[2] ?? "",
        ...(decodedLabel ? { label: decodedLabel } : {}),
        line: lineNumber,
        column: contentStart + 1,
        from: offset + contentStart,
        to: offset + rawLine.length,
      });
      continue;
    }

    const reference = referencePattern.exec(content);
    if (reference) {
      const owner = parent;
      if (!owner || indent !== owner.indent + 2) {
        diagnostics.push(
          diagnostic("References must be indented directly below a node.", lineNumber, 1, offset, offset + rawLine.length),
        );
        continue;
      }
      if (edges.length + connections.length + references.length >= maxEdges) {
        diagnostics.push(
          diagnostic("A BranchScript document can contain at most 5,000 connections.", lineNumber, contentStart + 1, offset + contentStart, offset + rawLine.length),
        );
        continue;
      }
      references.push({
        source: owner.node.id,
        target: reference[1] ?? "",
        line: lineNumber,
        column: contentStart + 1,
        from: offset + contentStart,
        to: offset + rawLine.length,
      });
      continue;
    }

    diagnostics.push(
      diagnostic("Unrecognized BranchScript statement.", lineNumber, contentStart + 1, offset + contentStart, offset + rawLine.length),
    );
  }

  for (const reference of references) {
    if (!identifiers.has(reference.target)) {
      diagnostics.push(
        diagnostic(
          `Unknown reference target: ${reference.target}.`,
          reference.line,
          reference.column,
          reference.from,
          reference.to,
        ),
      );
      continue;
    }
    edges.push({
      id: `reference:${reference.source}:${reference.target}`,
      source: reference.source,
      target: reference.target,
      kind: "reference",
    });
  }

  for (const connection of connections) {
    const missing = [connection.source, connection.target].filter((id) => !identifiers.has(id));
    if (missing.length > 0) {
      diagnostics.push(
        diagnostic(
          `Unknown connection node: ${missing.join(", ")}.`,
          connection.line,
          connection.column,
          connection.from,
          connection.to,
        ),
      );
      continue;
    }
    edges.push({
      id: `connection:${connection.source}:${connection.target}:${connection.line}`,
      source: connection.source,
      target: connection.target,
      kind: "connection",
      ...(connection.label ? { label: connection.label } : {}),
    });
  }

  if (nodes.length === 0 && !treeSeen) {
    diagnostics.push(diagnostic("Add at least one node.", 1, 1, 0, Math.min(source.length, 1)));
  }

  if (hasCycle(nodes, edges.filter((edge) => edge.kind !== "connection"))) {
    diagnostics.push(diagnostic("References must not create a cycle.", 1, 1, 0, Math.min(source.length, 1)));
  } else if ((view === "tree" || view === "neural") && hasCycle(nodes, edges)) {
    diagnostics.push(
      diagnostic(`${view} diagrams must not contain cycles.`, 1, 1, 0, Math.min(source.length, 1)),
    );
  }

  if (diagnostics.some((item) => item.severity === "error")) return { diagnostics };

  const parsed = graphDocumentSchema.safeParse({
    version: "0.1",
    id: documentId,
    title,
    view,
    nodes,
    edges,
  });

  if (!parsed.success) {
    diagnostics.push(diagnostic("The compiled graph failed document validation.", 1, 1, 0, Math.min(source.length, 1)));
    return { diagnostics };
  }

  return { document: parsed.data, diagnostics };
}
