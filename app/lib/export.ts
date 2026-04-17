import { TranscriptChunk, SuggestionBatch, ChatMessage, ExportData } from "../types";
import { formatDuration, formatTime } from "./utils";

export function buildExportData(
  transcriptChunks: TranscriptChunk[],
  suggestionBatches: SuggestionBatch[],
  chatMessages: ChatMessage[],
  sessionStartTime: Date | null
): ExportData {
  const now = new Date();
  const duration = sessionStartTime
    ? formatDuration(now.getTime() - sessionStartTime.getTime())
    : "N/A";

  return {
    exportedAt: now.toISOString(),
    sessionDuration: duration,
    transcript: transcriptChunks.map((c) => ({
      timestamp: formatDuration(c.timestamp),
      text: c.text,
    })),
    suggestionBatches: suggestionBatches.map((batch) => ({
      createdAt: batch.createdAt.toISOString(),
      suggestions: batch.suggestions.map((s) => ({
        type: s.type,
        preview: s.preview,
        detail: s.detail,
      })),
    })),
    chat: chatMessages.map((m) => ({
      role: m.role,
      content: m.content,
      createdAt: m.createdAt.toISOString(),
    })),
  };
}

export function exportAsJSON(data: ExportData): void {
  const json = JSON.stringify(data, null, 2);
  downloadFile(json, `twinmind-session-${Date.now()}.json`, "application/json");
}

export function exportAsText(data: ExportData): void {
  const lines: string[] = [];

  lines.push("=== TWINMIND SESSION EXPORT ===");
  lines.push(`Exported: ${data.exportedAt}`);
  lines.push(`Duration: ${data.sessionDuration}`);
  lines.push("");

  lines.push("=== TRANSCRIPT ===");
  if (data.transcript.length === 0) {
    lines.push("(No transcript)");
  } else {
    data.transcript.forEach((c) => {
      lines.push(`[${c.timestamp}] ${c.text}`);
    });
  }
  lines.push("");

  lines.push("=== SUGGESTION BATCHES ===");
  if (data.suggestionBatches.length === 0) {
    lines.push("(No suggestions)");
  } else {
    data.suggestionBatches.forEach((batch, i) => {
      lines.push(`\n--- Batch ${i + 1} (${batch.createdAt}) ---`);
      batch.suggestions.forEach((s, j) => {
        lines.push(`${j + 1}. [${s.type.toUpperCase()}] ${s.preview}`);
        if (s.detail) {
          lines.push(`   Detail: ${s.detail}`);
        }
      });
    });
  }
  lines.push("");

  lines.push("=== CHAT HISTORY ===");
  if (data.chat.length === 0) {
    lines.push("(No chat messages)");
  } else {
    data.chat.forEach((m) => {
      lines.push(`[${m.createdAt}] ${m.role.toUpperCase()}: ${m.content}`);
      lines.push("");
    });
  }

  downloadFile(lines.join("\n"), `twinmind-session-${Date.now()}.txt`, "text/plain");
}

function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
