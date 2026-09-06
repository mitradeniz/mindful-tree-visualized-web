import { describe, expect, it } from 'vitest';
import { projectFingerprint } from '../src/app/project-state';
import { drawingPath, readDrawings, writeDrawings, type DrawingStroke } from '../src/canvas/drawing-layer';
import { compileMindTree } from '../src/scripting/compiler';

describe('project change tracking', () => {
  const state = { source: 'diagram test "Test"\n@view tree\n', direction: 'TB' as const, positions: { a: { x: 1, y: 2 }, b: { x: 4, y: 8 } } };
  it('uses stable layout order and tracks content and moves', () => {
    expect(projectFingerprint(state)).toBe(projectFingerprint({ ...state, positions: { b: state.positions.b, a: state.positions.a } }));
    expect(projectFingerprint(state)).not.toBe(projectFingerprint({ ...state, source: state.source + '# note' }));
    expect(projectFingerprint(state)).not.toBe(projectFingerprint({ ...state, positions: { a: { x: 2, y: 2 } } }));
  });
});

describe('drawing persistence', () => {
  const stroke: DrawingStroke = { id: 'test', tool: 'pen', color: '#149b83', width: 3, points: [{ x: 10, y: 10 }, { x: 30, y: 40 }] };
  const source = 'diagram demo "Demo"\n@view tree\n';
  it('round trips through valid script comments without duplicate entries', () => {
    const saved = writeDrawings(source, [stroke]);
    expect(readDrawings(saved)).toEqual([stroke]);
    expect(writeDrawings(saved, [stroke])).toBe(saved);
    expect(compileMindTree(saved).diagnostics).toEqual([]);
    expect(readDrawings(writeDrawings(saved, []))).toEqual([]);
  });
  it('ignores unsafe or malformed imported strokes', () => {
    expect(readDrawings('# branchscript-drawing {invalid}\n')).toEqual([]);
    expect(readDrawings('# branchscript-drawing ' + JSON.stringify({ ...stroke, color: 'url(https://evil)' }))).toEqual([]);
  });
  it('renders bounded geometry including reverse dragging', () => {
    expect(drawingPath({ ...stroke, tool: 'rectangle', points: [...stroke.points].reverse() })).toBe('M10,10h20v30h-20Z');
    expect(drawingPath(stroke)).toBe('M10,10 L30,40');
  });
});
