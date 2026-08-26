const CRC32_POLYNOMIAL = 0xedb88320;

/**
 * Создаёт стабильный анонимизированный идентификатор пользователя для OpenAI.
 *
 * @param {string|number|bigint} id - Идентификатор пользователя.
 * @returns {string} CRC32-хэш в формате `user_00000000`.
 * @throws {TypeError} Если передан некорректный идентификатор.
 */
export function createSafetyIdentifier(id) {
  if (
    !["string", "number", "bigint"].includes(typeof id) ||
    String(id).trim() === ""
  ) {
    throw new TypeError("id должен быть непустым идентификатором");
  }

  const value = String(id);

  let crc = 0xffffffff;

  for (const byte of new TextEncoder().encode(value)) {
    crc ^= byte;

    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? CRC32_POLYNOMIAL : 0);
    }
  }

  const hash = ((crc ^ 0xffffffff) >>> 0)
    .toString(16)
    .padStart(8, "0");

  return `user_${hash}`;
}
