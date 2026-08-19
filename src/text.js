const MAX_TELEGRAM_MESSAGE_LENGTH = 4096;

/**
 * Сдвигает индекс разреза влево на один символ, если он приходится на середину суррогатной пары.
 *
 * @param {string} text - Полный текст, в котором ищется индекс.
 * @param {number} index - Предполагаемый индекс разреза.
 * @returns {number} Скорректированный индекс, не разрывающий суррогатную пару.
 */
function avoidSplittingSurrogatePair(text, index) {
  if (index > 0 && index < text.length) {
    const previous = text.charCodeAt(index - 1);
    const next = text.charCodeAt(index);
    if (previous >= 0xd800 && previous <= 0xdbff && next >= 0xdc00 && next <= 0xdfff) {
      return index - 1;
    }
  }
  return index;
}

/**
 * Разбивает текст на части, пригодные для отправки в Telegram, каждая из которых не превышает лимит длины.
 * Разрез выполняется по границе строки или пробела, если это возможно, и никогда не разрывает суррогатную пару.
 *
 * @param {string} text - Исходный текст для разбиения.
 * @param {number} [maximumLength=MAX_TELEGRAM_MESSAGE_LENGTH] - Максимальная длина одной части.
 * @returns {string[]} Массив частей текста.
 */
function splitForTelegram(text, maximumLength = MAX_TELEGRAM_MESSAGE_LENGTH) {
  if (typeof text !== "string") {
    throw new TypeError("Текст для отправки в Telegram должен быть строкой.");
  }
  if (!Number.isInteger(maximumLength) || maximumLength < 2) {
    throw new RangeError("Максимальная длина сообщения должна быть целым числом не меньше 2.");
  }
  if (text.length <= maximumLength) {
    return [text];
  }

  const chunks = [];
  let remaining = text;
  while (remaining.length > maximumLength) {
    const searchEnd = maximumLength - 1;
    let boundary = remaining.lastIndexOf("\n", searchEnd);
    if (boundary < Math.floor(maximumLength / 2)) {
      boundary = remaining.lastIndexOf(" ", searchEnd);
    }

    // Разделитель остаётся в предыдущей части: форматирование не теряется.
    let splitAt = boundary >= 0 ? boundary + 1 : maximumLength;
    splitAt = avoidSplittingSurrogatePair(remaining, splitAt);
    if (splitAt < 1) {
      splitAt = maximumLength;
    }

    chunks.push(remaining.slice(0, splitAt));
    remaining = remaining.slice(splitAt);
  }
  if (remaining) {
    chunks.push(remaining);
  }
  return chunks;
}

export { MAX_TELEGRAM_MESSAGE_LENGTH, splitForTelegram };
