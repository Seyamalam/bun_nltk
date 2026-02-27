import { expect, test } from "bun:test";
import {
  bracketToTree,
  collapseUnaryChains,
  mapTreeLabels,
  treeDepth,
  treeLeaves,
  treeToBracket,
  type ParseTree,
} from "../index";

const tree: ParseTree = {
  label: "S",
  children: [
    { label: "NP", children: [{ label: "Name", children: ["alice"] }] },
    {
      label: "VP",
      children: [
        { label: "V", children: ["sees"] },
        { label: "NP", children: [{ label: "Det", children: ["the"] }, { label: "N", children: ["dog"] }] },
      ],
    },
  ],
};

test("tree utilities expose leaves and depth", () => {
  expect(treeLeaves(tree)).toEqual(["alice", "sees", "the", "dog"]);
  expect(treeDepth(tree)).toBe(4);
});

test("tree bracket conversion round-trips", () => {
  const bracket = treeToBracket(tree);
  const parsed = bracketToTree(bracket);
  expect(treeToBracket(parsed)).toBe(bracket);
});

test("tree label mapping and unary collapse work", () => {
  const upper = mapTreeLabels(tree, (label) => label.toUpperCase());
  expect(upper.label).toBe("S");
  expect(treeToBracket(upper)).toContain("(NP");

  const unary: ParseTree = {
    label: "S",
    children: [{ label: "VP", children: [{ label: "V", children: ["run"] }] }],
  };
  const collapsed = collapseUnaryChains(unary);
  expect(collapsed.label).toBe("S+VP+V");
  expect(collapsed.children).toEqual(["run"]);
});
