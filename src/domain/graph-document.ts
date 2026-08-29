import { z } from "zod";

export const nodeKinds = [
  "topic",
  "question",
  "response",
  "followup",
  "note",
  "text",
  "example",
  "input",
  "layer",
  "neuron",
  "process",
  "decision",
  "outcome",
  "output",
  "start",
  "function",
  "operation",
  "condition",
  "loop",
  "return",
  "array",
  "item",
  "stack",
  "queue",
  "list",
  "record",
  "pointer",
] as const;

export const priorities = ["low", "normal", "high"] as const;
export const diagramViews = ["tree", "flow", "neural", "logic", "algorithm", "data"] as const;
export const nodeColors = ["green", "blue", "amber", "purple", "red", "gray"] as const;
export const nodeShapes = ["card", "pill", "diamond", "circle"] as const;
export const nodeStatuses = ["idea", "active", "done", "blocked"] as const;
export const fontFamilies = ["sans", "serif", "mono"] as const;
export const fontWeights = ["regular", "medium", "bold"] as const;
export const textAlignments = ["left", "center", "right"] as const;
export const nodeWidths = ["compact", "normal", "wide"] as const;

export const sourcePointSchema = z.object({
  offset: z.number().int().nonnegative(),
  line: z.number().int().positive(),
  column: z.number().int().positive(),
});

export const sourceSpanSchema = z.object({
  from: sourcePointSchema,
  to: sourcePointSchema,
});

const identifierSchema = z.string().regex(/^[A-Za-z][\w-]*$/).max(80);

export const graphNodeSchema = z.object({
  id: identifierSchema,
  kind: z.enum(nodeKinds),
  label: z.string().min(1).max(160),
  text: z.string().min(1).max(420).optional(),
  answer: z.string().min(1).max(600).optional(),
  feature: z.string().min(1).max(120).optional(),
  category: z.string().min(1).max(60).optional(),
  items: z.array(z.string().min(1).max(80)).max(8).optional(),
  fields: z.array(z.string().min(1).max(80)).max(8).optional(),
  parentId: identifierSchema.optional(),
  tags: z.array(z.string().min(1).max(40)).max(20),
  priority: z.enum(priorities),
  color: z.enum(nodeColors).optional(),
  shape: z.enum(nodeShapes).optional(),
  status: z.enum(nodeStatuses).optional(),
  fontFamily: z.enum(fontFamilies).optional(),
  fontSize: z.number().int().min(10).max(48).optional(),
  fontWeight: z.enum(fontWeights).optional(),
  textAlign: z.enum(textAlignments).optional(),
  width: z.enum(nodeWidths).optional(),
  source: sourceSpanSchema,
});

export const graphEdgeSchema = z.object({
  id: z.string().min(1),
  source: identifierSchema,
  target: identifierSchema,
  kind: z.enum(["branch", "reference", "connection"]),
  label: z.string().min(1).max(80).optional(),
});

export const graphDocumentSchema = z.object({
  version: z.literal("0.1"),
  id: identifierSchema,
  title: z.string().min(1).max(160),
  view: z.enum(diagramViews),
  nodes: z.array(graphNodeSchema).max(2_000),
  edges: z.array(graphEdgeSchema).max(5_000),
});

export type NodeKind = (typeof nodeKinds)[number];
export type Priority = (typeof priorities)[number];
export type DiagramView = (typeof diagramViews)[number];
export type NodeColor = (typeof nodeColors)[number];
export type NodeShape = (typeof nodeShapes)[number];
export type NodeStatus = (typeof nodeStatuses)[number];
export type FontFamily = (typeof fontFamilies)[number];
export type FontWeight = (typeof fontWeights)[number];
export type TextAlignment = (typeof textAlignments)[number];
export type NodeWidth = (typeof nodeWidths)[number];
export type SourcePoint = z.infer<typeof sourcePointSchema>;
export type SourceSpan = z.infer<typeof sourceSpanSchema>;
export type GraphNode = z.infer<typeof graphNodeSchema>;
export type GraphEdge = z.infer<typeof graphEdgeSchema>;
export type GraphDocument = z.infer<typeof graphDocumentSchema>;
