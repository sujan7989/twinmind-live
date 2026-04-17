import { TranscriptChunk, ChatMessage, Suggestion } from "../types";

/** Format milliseconds as MM:SS */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/** Format a Date as HH:MM:SS */
export function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

/** Get the most recent N characters of transcript text */
export function getRecentTranscript(
  chunks: TranscriptChunk[],
  maxChars: number
): string {
  const fullText = chunks.map((c) => c.text).join(" ").trim();
  if (fullText.length <= maxChars) return fullText;
  // Take from the end, but try to start at a word boundary
  const truncated = fullText.slice(-maxChars);
  const firstSpace = truncated.indexOf(" ");
  return firstSpace > 0 ? truncated.slice(firstSpace + 1) : truncated;
}

/** Get full transcript text */
export function getFullTranscript(chunks: TranscriptChunk[]): string {
  return chunks.map((c) => c.text).join(" ").trim();
}

/** Format chat history for prompt injection */
export function formatChatHistory(messages: ChatMessage[]): string {
  if (messages.length === 0) return "(No previous messages)";
  return messages
    .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
    .join("\n\n");
}

/** Generate a simple unique ID */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Truncate text with ellipsis */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + "...";
}

/** Format suggestions for "previous suggestions" context in prompt */
export function formatPreviousSuggestions(suggestions: Suggestion[]): string {
  if (suggestions.length === 0) return "(None)";
  return suggestions.map((s) => `- [${s.type}] ${s.preview}`).join("\n");
}
