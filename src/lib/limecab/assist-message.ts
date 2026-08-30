const MARKER = /\{\{textcon:([a-z][a-z0-9_-]*)\}\}/g;

export type AssistMessageSegment =
  | { type: "text"; value: string }
  | { type: "textcon"; id: string };

/** Split an Assist message into text and {{textcon:id}} segments. */
export function splitAssistMessage(message: string): AssistMessageSegment[] {
  const segments: AssistMessageSegment[] = [];
  let last = 0;
  for (const match of message.matchAll(MARKER)) {
    const index = match.index ?? 0;
    if (index > last) {
      segments.push({ type: "text", value: message.slice(last, index) });
    }
    segments.push({ type: "textcon", id: match[1]! });
    last = index + match[0].length;
  }
  if (last < message.length) {
    segments.push({ type: "text", value: message.slice(last) });
  }
  return segments.length > 0 ? segments : [{ type: "text", value: message }];
}
