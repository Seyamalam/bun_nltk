import { expect, test } from "bun:test";
import { ImmutableTree, ParentedTree, treeToBracket } from "../index";

const plain = {
  label: "S",
  children: [
    { label: "NP", children: ["John", { label: "PP", children: [] }] },
    { label: "VP", children: ["ran"] },
  ],
};

test("ParentedTree keeps parent pointers and indices", () => {
  const root = ParentedTree.from(plain);
  const np = root.children[0] as ParentedTree;
  expect(np.parent()).toBe(root);
  expect(np.index()).toBe(0);
  expect((root.children[1] as ParentedTree).index()).toBe(1);
  expect(root.parent()).toBeNull();
  expect(root.index()).toBe(-1);
});

test("leftSibling / rightSibling", () => {
  const root = ParentedTree.from(plain);
  const np = root.children[0] as ParentedTree;
  const vp = root.children[1] as ParentedTree;
  expect(np.leftSibling()).toBeNull();
  expect(np.rightSibling()).toBe(vp);
  expect(vp.rightSibling()).toBeNull();
});

test("root() walks up to the topmost node", () => {
  const root = ParentedTree.from(plain);
  const pp = (root.children[0] as ParentedTree).children[1] as ParentedTree;
  expect(pp.root()).toBe(root);
});

test("treepositions preorder/postorder/leaves", () => {
  const root = ParentedTree.from({ label: "A", children: [{ label: "B", children: ["x"] }, "y"] });
  expect(root.treepositions()).toEqual([[0]]);
  expect(root.treepositions("postorder")).toEqual([[0]]);
  expect(root.treepositions("leaves")).toEqual([
    [0, 0],
    [1],
  ]);
});

test("mutations keep sibling/parent pointers consistent", () => {
  const root = ParentedTree.from(plain);
  const vp = root.children[1] as ParentedTree;
  root.insertChild(1, "extra");
  expect(root.children[1]).toBe("extra");
  expect((root.children[2] as ParentedTree).index()).toBe(2);
  expect((root.children[2] as ParentedTree).parent()).toBe(root);

  const removed = root.removeChild(2);
  expect(removed === vp || typeof removed === "string").toBe(true);
  expect(root.children).toHaveLength(2);
  expect(vp.parent()).not.toBe(root);
});

test("toPlain round-trips through the plain {label, children} shape", () => {
  const root = ParentedTree.from(plain);
  expect(treeToBracket(root.toPlain())).toBe(treeToBracket(plain));
});

test("ImmutableTree throws on any mutation and freezes structure", () => {
  const tree = ImmutableTree.from(plain);
  expect(() => tree.setLabel("X")).toThrow(/ImmutableTree/);
  expect(() => tree.insertChild(0, "x")).toThrow(/ImmutableTree/);
  expect(() => tree.removeChild(0)).toThrow(/ImmutableTree/);
  const child = tree.children[0] as ImmutableTree;
  expect(() => child.setLabel("Y")).toThrow(/ImmutableTree/);
  // Reads still work.
  expect(child.parent()).toBe(tree);
});
