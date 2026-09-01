import type { GraphDocument, GraphNode } from "../domain/graph-document";

interface SearchIndex {
  values: string[];
  words: string[];
}

interface QueryIndex {
  normalized: string;
  tokens: string[];
}

const nodeIndexes = new WeakMap<GraphNode, SearchIndex>();
const maxQueryTokens = 16;

function normalizeSearchText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function queryIndex(query: string): QueryIndex {
  const normalized = normalizeSearchText(query);
  return {
    normalized,
    tokens: [...new Set(normalized.split(" ").filter(Boolean))].slice(0, maxQueryTokens),
  };
}

function editDistance(left: string, right: string): number {
  if (left === right) return 0;
  if (!left.length) return right.length;
  if (!right.length) return left.length;

  let previousPrevious: number[] | null = null;
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const substitution = previous[rightIndex - 1]! + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1);
      let distance = Math.min(previous[rightIndex]! + 1, current[rightIndex - 1]! + 1, substitution);
      if (
        previousPrevious
        && leftIndex > 1
        && rightIndex > 1
        && left[leftIndex - 1] === right[rightIndex - 2]
        && left[leftIndex - 2] === right[rightIndex - 1]
      ) {
        distance = Math.min(distance, previousPrevious[rightIndex - 2]! + 1);
      }
      current[rightIndex] = distance;
    }
    previousPrevious = previous;
    previous = current;
  }
  return previous[right.length]!;
}

function typoTolerance(length: number): number {
  if (length >= 10) return 3;
  if (length >= 6) return 2;
  if (length >= 4) return 1;
  return 0;
}

function fuzzyScore(queryToken: string, candidate: string): number {
  const tolerance = typoTolerance(queryToken.length);
  if (tolerance === 0) return 0;

  if (Math.abs(candidate.length - queryToken.length) <= tolerance) {
    const distance = editDistance(queryToken, candidate);
    if (distance <= tolerance) return 64 - distance * 8;
  }

  // Keep type-ahead useful when the entered prefix itself contains a typo.
  if (candidate.length > queryToken.length) {
    const prefix = candidate.slice(0, queryToken.length);
    const distance = editDistance(queryToken, prefix);
    if (distance <= tolerance) return 48 - distance * 6;
  }
  return 0;
}

function tokenMatchScore(queryToken: string, candidate: string): number {
  if (candidate === queryToken) return 100;
  if (candidate.startsWith(queryToken)) return 88;
  if (queryToken.length >= 2 && candidate.includes(queryToken)) return 76;
  return fuzzyScore(queryToken, candidate);
}

function searchableValues(node: GraphNode): string[] {
  return [
    node.id,
    node.label,
    node.text,
    node.answer,
    node.feature,
    node.category,
    ...node.tags,
    ...(node.items ?? []),
    ...(node.fields ?? []),
  ].filter((value): value is string => Boolean(value));
}

function searchIndex(node: GraphNode): SearchIndex {
  const cached = nodeIndexes.get(node);
  if (cached) return cached;
  const values = searchableValues(node).map(normalizeSearchText).filter(Boolean);
  const index = {
    values,
    words: [...new Set(values.flatMap((value) => value.split(" ")).filter(Boolean))],
  };
  nodeIndexes.set(node, index);
  return index;
}

function valueContainsAllTokens(value: string, queryTokens: string[]): boolean {
  const words = value.split(" ").filter(Boolean);
  return queryTokens.every((queryToken) =>
    words.some((candidate) => tokenMatchScore(queryToken, candidate) > 0));
}

function nodeSearchScore(node: GraphNode, query: QueryIndex): number {
  if (!query.normalized) return 1;
  if (query.tokens.length === 0) return 0;

  const index = searchIndex(node);
  if (query.tokens.every((token) => token.length < 3)) {
    return query.tokens.every((queryToken) =>
      index.words.some((candidate) => candidate.includes(queryToken))) ? 1 : 0;
  }
  const tokenScores = query.tokens.map((queryToken) =>
    index.words.reduce((best, candidate) => Math.max(best, tokenMatchScore(queryToken, candidate)), 0),
  );

  // Multi-word queries are AND searches: every term must occur in this node,
  // either exactly, partially, or within the typo tolerance.
  if (tokenScores.some((score) => score === 0)) return 0;

  const exactPhrase = index.values.some((value) => value.includes(query.normalized));
  const sameValue = index.values.some((value) => valueContainsAllTokens(value, query.tokens));
  return (exactPhrase ? 2_000 : 0)
    + (sameValue ? 800 : 0)
    + tokenScores.reduce((total, score) => total + score, 0);
}

export function nodeMatchesSearch(node: GraphNode, query: string): boolean {
  return nodeSearchScore(node, queryIndex(query)) > 0;
}

export function matchingNodeIds(document: GraphDocument, query: string): string[] {
  const indexedQuery = queryIndex(query);
  if (!indexedQuery.normalized) return [];
  return document.nodes
    .map((node, index) => ({ id: node.id, index, score: nodeSearchScore(node, indexedQuery) }))
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map(({ id }) => id);
}
