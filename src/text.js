const MAX_TELEGRAM_MESSAGE_LENGTH = 4096;

function splitForTelegram(text, maximumLength = MAX_TELEGRAM_MESSAGE_LENGTH) {
  if (text.length <= maximumLength) return [text];

  const chunks = [];
  let remaining = text;
  while (remaining.length > maximumLength) {
    let boundary = remaining.lastIndexOf("\n", maximumLength);
    if (boundary < maximumLength / 2) boundary = remaining.lastIndexOf(" ", maximumLength);
    if (boundary < 1) boundary = maximumLength;
    chunks.push(remaining.slice(0, boundary).trimEnd());
    remaining = remaining.slice(boundary).trimStart();
  }
  if (remaining) chunks.push(remaining);
  return chunks;
}

export { MAX_TELEGRAM_MESSAGE_LENGTH, splitForTelegram };
