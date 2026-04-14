/**
 * Custom serializer/deserializer for TanStack Query localStorage persistence.
 *
 * Handles:
 *  - Date instances → { __type: 'Date', value: isoString } → Date
 *  - Plain objects are traversed recursively
 *
 * After normalizing UserSettings to use Date (not Firestore Timestamp),
 * this handles all date serialization needs across the app.
 */

function serializeValue(val: unknown): unknown {
  if (val instanceof Date) {
    return { __type: 'Date', value: val.toISOString() };
  }
  if (Array.isArray(val)) {
    return val.map(serializeValue);
  }
  if (val !== null && typeof val === 'object') {
    return Object.fromEntries(
      Object.entries(val as Record<string, unknown>).map(([k, v]) => [k, serializeValue(v)])
    );
  }
  return val;
}

function deserializeValue(val: unknown): unknown {
  if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
    const obj = val as Record<string, unknown>;
    if (obj.__type === 'Date' && typeof obj.value === 'string') {
      return new Date(obj.value);
    }
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [k, deserializeValue(v)])
    );
  }
  if (Array.isArray(val)) {
    return val.map(deserializeValue);
  }
  return val;
}

export const querySerializer = {
  serialize: (data: unknown): string => JSON.stringify(serializeValue(data)),
  deserialize: (str: string): unknown => deserializeValue(JSON.parse(str)),
};
