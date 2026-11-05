// 22 px row plus 6 px gap. Keep in step with .explorer .row in style.css.
export const ROW_PITCH = 28;
// Rows past the edge are ready before a fast scroll reaches them.
const OVERSCAN = 10;

export interface Row<T> {node: T; depth: number; position: number; siblings: number}

export function flattenRows<T extends {key: string; children: T[]}>(nodes: T[], opened: (key: string, depth: number) => boolean) {
  const rows: Row<T>[] = [];
  const add = (list: T[], depth: number) => list.forEach((node, index) => {
    rows.push({node, depth, position: index + 1, siblings: list.length});
    if (node.children.length && opened(node.key, depth)) add(node.children, depth + 1);
  });
  add(nodes, 0);
  return rows;
}

// The last index is exclusive.
export function rowWindow(scrollTop: number, height: number, count: number): [number, number] {
  return [Math.max(0, Math.floor(scrollTop / ROW_PITCH) - OVERSCAN), Math.min(count, Math.ceil((scrollTop + height) / ROW_PITCH) + OVERSCAN)];
}

export function revealRow(scrollTop: number, height: number, index: number) {
  const top = index * ROW_PITCH;
  if (top < scrollTop) return top;
  return top + ROW_PITCH > scrollTop + height ? top + ROW_PITCH - height : scrollTop;
}
