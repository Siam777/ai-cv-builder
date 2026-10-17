import test from "node:test";
import assert from "node:assert/strict";
import { blankState, blanksReady, composeBlanks } from "../src/lib/starter-blanks";

const template = "Designed and delivered [software systems] to improve [performance metric] for [user group].";

test("unfilled blanks stay in brackets and block adding", () => {
  const state = blankState(template);
  assert.deepEqual(state.fills, ["", "", ""]);
  assert.equal(composeBlanks(state), template);
  assert.equal(blanksReady(state), false);
});

test("filled and removed blanks make a clean sentence", () => {
  const state = blankState(template);
  state.fills[0] = "a billing platform";
  state.fills[1] = " invoice processing time ";
  assert.equal(blanksReady(state), false);
  state.removed[2] = true;
  // The dangling "for" goes with the removed blank.
  assert.equal(composeBlanks(state), "Designed and delivered a billing platform to improve invoice processing time.");
  assert.equal(blanksReady(state), true);
});

test("a linking word stays when text other than punctuation follows the removed blank", () => {
  const state = blankState("Built [applications] using [languages] and tests.");
  state.fills[0] = "APIs";
  state.removed[1] = true;
  assert.equal(composeBlanks(state), "Built APIs using and tests.");
});

test("editing the whole sentence wins, and brackets left in it still block adding", () => {
  const state = { ...blankState(template), free: "Designed a billing platform for [user group]." };
  assert.equal(blanksReady(state), false);
  state.free = "Designed a billing platform for finance teams.";
  assert.equal(composeBlanks(state), "Designed a billing platform for finance teams.");
  assert.equal(blanksReady(state), true);
  assert.equal(blanksReady({ ...state, free: "   " }), false);
});
