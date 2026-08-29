import type { GraphDocument, GraphNode } from "../domain/graph-document";

export function nodeMatchesSearch(node: GraphNode, query: string): boolean {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return true;
  return [node.id, node.label, node.text, node.answer, node.feature, node.category, ...node.tags]
    .filter((value): value is string => Boolean(value))
    .some((value) => value.toLocaleLowerCase().includes(normalized));
}

export function matchingNodeIds(document: GraphDocument, query: string): string[] {
  if (!query.trim()) return [];
  return document.nodes.filter((node) => nodeMatchesSearch(node, query)).map((node) => node.id);
}
