import { Node } from 'estree';

export type NodeCallback = (child: Node, parent?: Node, prop?: string) => 'done' | 'skip' | undefined | any;

export function simpleWalkSync(node: Node, callback?: NodeCallback): void {
  if (!node) { return; }

  let op: 'done' | 'skip' | undefined = undefined;
  if (callback) {
    op = callback(node);
  }

  function innerWalk(node: Node): void {
    Object.keys(node).forEach(prop => {
      const value = node[prop];
      const valueAsArray: Node[] = Array.isArray(value) ? value : [value];
      valueAsArray.forEach(child => {
        if (op === 'done') { return; }
        if (child && typeof child.type === 'string' && callback) {
          op = callback(child, node, prop);
          if (typeof op === 'string') { op = op.toLowerCase() as any; }
          if (op !== 'done' && op !== 'skip') {
            innerWalk(child);
          }
        }
      });
    });
  }

  innerWalk(node);
}
