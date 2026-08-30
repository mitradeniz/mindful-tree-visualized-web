import type { GraphDocument, GraphNode } from "../domain/graph-document";

function normalizeSearchText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function editDistance(left: string, right: string): number {
  if (left === right) return 0;
  if (!left.length) return right.length;
  if (!right.length) return left.length;

  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const substitution = previous[rightIndex - 1]! + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1);
      current[rightIndex] = Math.min(previous[rightIndex]! + 1, current[rightIndex - 1]! + 1, substitution);
    }
    previous = current;
  }
  return previous[right.length]!;
}

function tokenMatchScore(queryToken: string, candidate: string): number {
  if (candidate === queryToken) return 50;
  if (candidate.startsWith(queryToken)) return 40;
  if (candidate.includes(queryToken)) return 30;

  const tolerance = queryToken.length >= 7 ? 2 : queryToken.length >= 4 ? 1 : 0;
  return tolerance > 0 && Math.abs(candidate.length - queryToken.length) <= tolerance && editDistance(queryToken, candidate) <= tolerance
    ? 20
    : 0;
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

function nodeSearchScore(node: GraphNode, query: string): number {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return 1;

  const values = searchableValues(node).map(normalizeSearchText).filter(Boolean);
  const words = values.flatMap((value) => value.split(" ")).filter(Boolean);
  const allQueryTokens = [...new Set(normalizedQuery.split(" ").filter(Boolean))];
  const meaningfulTokens = allQueryTokens.filter((token) => token.length >= 3);
  const queryTokens = meaningfulTokens.length > 0 ? meaningfulTokens : allQueryTokens;
  if (queryTokens.length === 0) return 0;

  if (queryTokens.every((token) => token.length < 3)) {
    return queryTokens.some((queryToken) => words.some((candidate) => candidate.includes(queryToken))) ? 1 : 0;
  }

  const phraseMatch = values.some((value) => value.includes(normalizedQuery));
  const tokenScores = queryTokens.map((queryToken) =>
    words.reduce((best, candidate) => Math.max(best, tokenMatchScore(queryToken, candidate)), 0),
  );
  const matchedTokenCount = tokenScores.filter((score) => score > 0).length;
  const minimumMatches = queryTokens.length <= 2 ? 1 : Math.ceil(queryTokens.length * 0.6);
  if (!phraseMatch && matchedTokenCount < minimumMatches) return 0;

  const allTokensMatch = matchedTokenCount === queryTokens.length;
  return (phraseMatch ? 1_000 : 0) + (allTokensMatch ? 500 : 0) + tokenScores.reduce((total, score) => total + score, 0);
}

export function nodeMatchesSearch(node: GraphNode, query: string): boolean {
  return nodeSearchScore(node, query) > 0;
}

export function matchingNodeIds(document: GraphDocument, query: string): string[] {
  if (!query.trim()) return [];
  return document.nodes
    .map((node, index) => ({ id: node.id, index, score: nodeSearchScore(node, query) }))
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map(({ id }) => id);
}
