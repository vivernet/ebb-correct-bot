import test from "node:test";
import assert from "node:assert/strict";
import { MAX_TELEGRAM_MESSAGE_LENGTH, splitForTelegram } from "../src/text.js";

test("не разделяет короткие сообщения", () => {
  assert.deepEqual(splitForTelegram("Готовый текст"), ["Готовый текст"]);
});

test("разделяет длинное сообщение без потери содержимого", () => {
  const text = `${"слово ".repeat(2_000)}конец`;
  const parts = splitForTelegram(text);
  assert.ok(parts.length > 1);
  assert.ok(parts.every((part) => part.length <= MAX_TELEGRAM_MESSAGE_LENGTH));
  assert.equal(parts.join(""), text);
});

test("сохраняет пробелы и пустые строки на границе частей", () => {
  const text = `${"а".repeat(MAX_TELEGRAM_MESSAGE_LENGTH - 1)}   \n\nСледующая строка.`;
  const parts = splitForTelegram(text);
  assert.ok(parts.every((part) => part.length <= MAX_TELEGRAM_MESSAGE_LENGTH));
  assert.equal(parts.join(""), text);
});

test("не разрывает surrogate pair", () => {
  const text = `${"а".repeat(MAX_TELEGRAM_MESSAGE_LENGTH - 1)}😀конец`;
  const parts = splitForTelegram(text);
  assert.ok(parts.every((part) => part.length <= MAX_TELEGRAM_MESSAGE_LENGTH));
  assert.equal(parts.join(""), text);
});

test("проверяет аргументы разбиения", () => {
  assert.throws(() => splitForTelegram(null), TypeError);
  assert.throws(() => splitForTelegram("текст", 1), RangeError);
});
