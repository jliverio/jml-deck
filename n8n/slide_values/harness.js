// Offline harness: runs the Code nodes of "9 Slide values" with the rows of a real run and a hand-written model answer.
const fs = require('fs');
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const code = (f) => fs.readFileSync(__dirname + '/' + f, 'utf8');
async function run(file, ctx) {
  const fn = new AsyncFunction('$', '$input', '$runIndex', code(file));
  const outs = ctx.outs;
  const $ = (name) => { if (!(name in outs)) throw new Error("Node '" + name + "' hasn't been executed"); const items = outs[name]; return { first: () => items[0], last: () => items[items.length - 1], all: () => items }; };
  const input = ctx.input;
  return fn($, { first: () => input[0], last: () => input[input.length - 1], all: () => input }, ctx.runIndex || 0);
}
module.exports = { run };
