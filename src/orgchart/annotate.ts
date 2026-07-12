import type { AnnotatedNode, LayoutDirection, OrgPerson, StackSide } from "./types";

interface AnnotateResult {
  node: AnnotatedNode;
  matches: boolean;
}

interface AnnotateState {
  query: string; // already trimmed + lowercased
  collapsed: Record<string, boolean>;
  layoutOverrides: Record<string, LayoutDirection>;
  stackSides: Record<string, StackSide>;
}

// `inheritedSide` is the effective stack side flowing down from the nearest ancestor. A
// node uses its own explicit override if set, otherwise inherits — so flipping one node
// flips its whole subtree, keeping every stack in a branch on the same side (mixing sides
// within one stack would break connector alignment, so it is intentionally not offered).
function annotateNode(node: OrgPerson, state: AnnotateState, inheritedSide: StackSide): AnnotateResult {
  const { query, collapsed, layoutOverrides, stackSides } = state;
  const stackSide = stackSides[node.id] ?? inheritedSide;
  const isCollapsed = !!collapsed[node.id];
  const selfMatches =
    !!query &&
    (node.name.toLowerCase().includes(query) ||
      node.title.toLowerCase().includes(query) ||
      node.dept.toLowerCase().includes(query));

  let childMatches = false;
  const children: AnnotatedNode[] = node.children.map((c) => {
    const r = annotateNode(c, state, stackSide);
    if (r.matches) childMatches = true;
    return r.node;
  });

  const expanded = query ? selfMatches || childMatches || !isCollapsed : !isCollapsed;
  const layout = layoutOverrides[node.id] ?? node.childLayout;

  const out: AnnotatedNode = {
    ...node,
    children,
    expanded,
    hasChildren: node.children.length > 0,
    layoutHorizontal: layout === "horizontal",
    layoutVertical: layout === "vertical",
    stackSide,
    highlighted: selfMatches,
    dimmed: !!query && !selfMatches && !childMatches,
  };

  return { node: out, matches: selfMatches || childMatches };
}

export function annotate(
  tree: OrgPerson,
  searchQuery: string,
  collapsed: Record<string, boolean>,
  layoutOverrides: Record<string, LayoutDirection> = {},
  stackSides: Record<string, StackSide> = {},
): AnnotatedNode {
  return annotateNode(tree, { query: searchQuery.trim().toLowerCase(), collapsed, layoutOverrides, stackSides }, "right")
    .node;
}
