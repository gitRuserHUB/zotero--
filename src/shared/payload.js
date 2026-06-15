import {
  FRAGMENT_PREFIX,
  PAYLOAD_TTL_MS,
  PROTOCOL_VERSION,
} from "./constants.js";
import { normalizeMetadata } from "./metadata.js";

const FUTURE_TOLERANCE_MS = 5 * 60 * 1000;
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/u;

function payloadError(code) {
  return new Error(code);
}

function getNonce(options) {
  if (Object.prototype.hasOwnProperty.call(options, "nonce")) {
    if (typeof options.nonce !== "string" || !options.nonce.trim()) {
      throw payloadError("PAYLOAD_NONCE_REQUIRED");
    }
    return options.nonce;
  }

  const nonce = globalThis.crypto?.randomUUID?.();
  if (typeof nonce !== "string" || !nonce) {
    throw payloadError("PAYLOAD_NONCE_REQUIRED");
  }
  return nonce;
}

function bytesToBinary(bytes) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return binary;
}

function encodeBase64Url(value) {
  let base64;
  if (typeof globalThis.Buffer !== "undefined") {
    base64 = globalThis.Buffer.from(value, "utf8").toString("base64");
  } else {
    const bytes = new TextEncoder().encode(value);
    base64 = btoa(bytesToBinary(bytes));
  }

  return base64.replace(/\+/gu, "-").replace(/\//gu, "_").replace(/=+$/u, "");
}

function decodeBase64Url(value) {
  if (
    !BASE64URL_PATTERN.test(value) ||
    value.length % 4 === 1
  ) {
    throw payloadError("PAYLOAD_MALFORMED");
  }

  const base64 = value.replace(/-/gu, "+").replace(/_/gu, "/");
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");

  try {
    let bytes;
    if (typeof globalThis.Buffer !== "undefined") {
      bytes = globalThis.Buffer.from(padded, "base64");
    } else {
      const binary = atob(padded);
      bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    }
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw payloadError("PAYLOAD_MALFORMED");
  }
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function buildPayload(item, options = {}) {
  const now = options.now === undefined ? Date.now() : options.now;
  if (!Number.isFinite(now)) {
    throw payloadError("PAYLOAD_MALFORMED");
  }

  return {
    v: PROTOCOL_VERSION,
    createdAt: now,
    nonce: getNonce(options),
    item: normalizeMetadata(item),
  };
}

export function encodeFragment(payload) {
  let json;
  try {
    json = JSON.stringify(payload);
  } catch {
    throw payloadError("PAYLOAD_MALFORMED");
  }
  if (typeof json !== "string") {
    throw payloadError("PAYLOAD_MALFORMED");
  }
  return `${FRAGMENT_PREFIX}${encodeBase64Url(json)}`;
}

export function decodeFragment(fragment, options = {}) {
  if (typeof fragment !== "string" || !fragment.startsWith(FRAGMENT_PREFIX)) {
    throw payloadError("PAYLOAD_PREFIX_INVALID");
  }

  let payload;
  try {
    payload = JSON.parse(decodeBase64Url(fragment.slice(FRAGMENT_PREFIX.length)));
  } catch (error) {
    if (error?.message === "PAYLOAD_MALFORMED") {
      throw error;
    }
    throw payloadError("PAYLOAD_MALFORMED");
  }

  if (!isRecord(payload)) {
    throw payloadError("PAYLOAD_MALFORMED");
  }
  if (payload.v !== PROTOCOL_VERSION) {
    throw payloadError("PAYLOAD_VERSION_UNSUPPORTED");
  }
  if (!Number.isFinite(payload.createdAt)) {
    throw payloadError("PAYLOAD_MALFORMED");
  }

  const now = options.now === undefined ? Date.now() : options.now;
  if (!Number.isFinite(now)) {
    throw payloadError("PAYLOAD_MALFORMED");
  }
  if (payload.createdAt > now + FUTURE_TOLERANCE_MS) {
    throw payloadError("PAYLOAD_FROM_FUTURE");
  }
  if (now - payload.createdAt > PAYLOAD_TTL_MS) {
    throw payloadError("PAYLOAD_EXPIRED");
  }
  if (typeof payload.nonce !== "string" || !payload.nonce.trim()) {
    throw payloadError("PAYLOAD_NONCE_REQUIRED");
  }
  if (!isRecord(payload.item)) {
    throw payloadError("PAYLOAD_MALFORMED");
  }

  return {
    v: PROTOCOL_VERSION,
    createdAt: payload.createdAt,
    nonce: payload.nonce,
    item: normalizeMetadata(payload.item),
  };
}
