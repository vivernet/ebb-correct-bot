import test from "node:test";
import assert from "node:assert/strict";
import { splitForTelegram } from "../src/text.js";

test("не разделяет короткие сообщения", () => {
  assert.deepEqual(splitForTelegram("Готовый текст"), ["Готовый текст"]);
});

test("разделяет длинное сообщение без потери содержимого", () => {
  const text = `${"слово ".repeat(2_000)}конец`;
  const parts = splitForTelegram(text);
  assert.ok(parts.length > 1);
  assert.ok(parts.every((part) => part.length <= 4096));
  assert.equal(parts.join(" ").replace(/\s+/g, " ").trim(), text.replace(/\s+/g, " ").trim());
});
