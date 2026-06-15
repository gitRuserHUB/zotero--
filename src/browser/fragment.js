import { FRAGMENT_PREFIX } from "../shared/constants.js";
import { decodeFragment } from "../shared/payload.js";

export function consumeFragment({
  decode = decodeFragment,
  locationObject = globalThis.location,
  historyObject = globalThis.history,
} = {}) {
  const fragment = locationObject.hash;
  if (!fragment?.startsWith(FRAGMENT_PREFIX)) return null;

  try {
    return decode(fragment);
  } finally {
    historyObject.replaceState(
      historyObject.state,
      "",
      `${locationObject.pathname}${locationObject.search}`,
    );
  }
}
