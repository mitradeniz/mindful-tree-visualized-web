import type { GraphNode } from "../domain/graph-document";

export const maxDataCells = 8;

function splitValues(value: string): string[] {
  return value
    .split(/\s*(?:\||,|·|→|->)\s*/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, maxDataCells);
}

function labelValues(label: string): string[] {
  const bracketed = /\[([^\]]*)\]/.exec(label)?.[1];
  if (bracketed !== undefined) return splitValues(bracketed);
  const colon = label.indexOf(":");
  return splitValues(colon >= 0 ? label.slice(colon + 1) : label);
}

export function dataItems(node: GraphNode): string[] {
  return node.items?.length ? node.items.slice(0, maxDataCells) : labelValues(node.label);
}

export function dataFields(node: GraphNode): string[] {
  return node.fields?.length ? node.fields.slice(0, maxDataCells) : dataItems(node);
}
