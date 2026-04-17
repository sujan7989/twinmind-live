export interface TranscriptChunk {
  id: string;
  text: string;
  timestamp: number; // ms since session start
  createdAt: Date;
}

export interface Suggestion {
  id: string;
  type: "question" | "talking_point" | "answer" | "fact_check" | "clarification";
  preview: string;       // Short, standalone-useful preview (1-2 sentences)
  detail?: string;       // Populated when user clicks
  timestamp: number;
}

export interface SuggestionBatch {
  id: string;
  suggestions: Suggestion[];
  createdAt: Date;
  transcriptSnapshot: string; // The transcript context used to generate these
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: Date;
  suggestionId?: string; // If triggered by clicking a suggestion
}

export interface SessionSettings {
  groqApiKey: string;
  suggestionPrompt: string;
  detailPrompt: string;
  chatPrompt: string;
  suggestionContextWindow: number;  // number of recent transcript chars
  detailContextWindow: number;      // number of recent transcript chars
  refreshIntervalSeconds: number;
}

export interface ExportData {
  exportedAt: string;
  sessionDuration: string;
  transcript: Array<{
    timestamp: string;
    text: string;
  }>;
  suggestionBatches: Array<{
    createdAt: string;
    suggestions: Array<{
      type: string;
      preview: string;
      detail?: string;
    }>;
  }>;
  chat: Array<{
    role: string;
    content: string;
    createdAt: string;
  }>;
}
