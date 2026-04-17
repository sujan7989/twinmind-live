"use client";

import { useState, useCallback, useRef } from "react";
import {
  TranscriptChunk,
  SuggestionBatch,
  Suggestion,
  ChatMessage,
  SessionSettings,
} from "../types";
import {
  generateId,
  getRecentTranscript,
  getFullTranscript,
  formatChatHistory,
  formatPreviousSuggestions,
} from "../lib/utils";

interface UseSessionReturn {
  transcriptChunks: TranscriptChunk[];
  suggestionBatches: SuggestionBatch[];
  chatMessages: ChatMessage[];
  sessionStartTime: Date | null;
  isTranscribing: boolean;
  isGeneratingSuggestions: boolean;
  isChatLoading: boolean;
  suggestionsError: string | null;
  transcribeAudio: (blob: Blob) => Promise<void>;
  generateSuggestions: () => Promise<void>;
  fetchSuggestionDetail: (suggestion: Suggestion, batchId: string) => Promise<void>;
  sendChatMessage: (message: string, suggestionId?: string) => Promise<void>;
  startSession: () => void;
  endSession: () => void;
  clearSession: () => void;
  settings: SessionSettings;
  updateSettings: (updates: Partial<SessionSettings>) => void;
}

export function useSession(initialSettings: SessionSettings): UseSessionReturn {
  const [settings, setSettings] = useState<SessionSettings>(initialSettings);
  const [transcriptChunks, setTranscriptChunks] = useState<TranscriptChunk[]>([]);
  const [suggestionBatches, setSuggestionBatches] = useState<SuggestionBatch[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [sessionStartTime, setSessionStartTime] = useState<Date | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isGeneratingSuggestions, setIsGeneratingSuggestions] = useState(false);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [suggestionsError, setSuggestionsError] = useState<string | null>(null);

  // Keep refs to latest state for use in callbacks (avoids stale closures)
  const chunksRef = useRef<TranscriptChunk[]>([]);
  const batchesRef = useRef<SuggestionBatch[]>([]);
  const chatMessagesRef = useRef<ChatMessage[]>([]);
  const settingsRef = useRef<SessionSettings>(initialSettings);
  const sessionStartTimeRef = useRef<Date | null>(null);

  const updateSettings = useCallback((updates: Partial<SessionSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...updates };
      settingsRef.current = next;
      return next;
    });
  }, []);

  const startSession = useCallback(() => {
    const now = new Date();
    setSessionStartTime(now);
    sessionStartTimeRef.current = now;
  }, []);

  const endSession = useCallback(() => {
    // Session stays in memory, just marks end
  }, []);

  const clearSession = useCallback(() => {
    setTranscriptChunks([]);
    setSuggestionBatches([]);
    setChatMessages([]);
    setSessionStartTime(null);
    chunksRef.current = [];
    batchesRef.current = [];
    chatMessagesRef.current = [];
    sessionStartTimeRef.current = null;
  }, []);

  const transcribeAudio = useCallback(
    async (blob: Blob) => {
      if (!settingsRef.current.groqApiKey) return;
      if (blob.size < 1000) return; // Skip tiny/empty blobs

      setIsTranscribing(true);
      try {
        const formData = new FormData();
        formData.append("audio", blob, "audio.webm");
        formData.append("apiKey", settingsRef.current.groqApiKey);

        const res = await fetch("/api/transcribe", {
          method: "POST",
          body: formData,
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Transcription failed");

        const text: string = data.text?.trim() ?? "";
        if (!text) return;

        const chunk: TranscriptChunk = {
          id: generateId(),
          text,
          timestamp: sessionStartTimeRef.current
            ? Date.now() - sessionStartTimeRef.current.getTime()
            : 0,
          createdAt: new Date(),
        };

        setTranscriptChunks((prev) => {
          const next = [...prev, chunk];
          chunksRef.current = next;
          return next;
        });
      } catch (err) {
        console.error("Transcription error:", err);
      } finally {
        setIsTranscribing(false);
      }
    },
    [] // Uses sessionStartTimeRef — no stale closure
  );

  const generateSuggestions = useCallback(async () => {
    const currentSettings = settingsRef.current;
    if (!currentSettings.groqApiKey) return;

    const chunks = chunksRef.current;
    if (chunks.length === 0) return;

    const transcript = getRecentTranscript(
      chunks,
      currentSettings.suggestionContextWindow
    );
    if (transcript.trim().length < 20) return;

    // Collect all previous suggestions to avoid repetition
    const allPrevious = batchesRef.current.flatMap((b) => b.suggestions);
    const previousSuggestions = formatPreviousSuggestions(
      allPrevious.slice(-9) // Last 3 batches worth
    );

    setSuggestionsError(null);
    setIsGeneratingSuggestions(true);
    try {
      const res = await fetch("/api/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript,
          previousSuggestions,
          prompt: currentSettings.suggestionPrompt,
          apiKey: currentSettings.groqApiKey,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to generate suggestions");

      const suggestions: Suggestion[] = (data.suggestions ?? []).map(
        (s: { type: string; preview: string }) => ({
          id: generateId(),
          type: s.type as Suggestion["type"],
          preview: s.preview,
          timestamp: Date.now(),
        })
      );

      if (suggestions.length === 0) return;

      const batch: SuggestionBatch = {
        id: generateId(),
        suggestions,
        createdAt: new Date(),
        transcriptSnapshot: transcript,
      };

      setSuggestionBatches((prev) => {
        const next = [batch, ...prev]; // Newest first
        batchesRef.current = next;
        return next;
      });
    } catch (err) {
      console.error("Suggestions error:", err);
      setSuggestionsError(err instanceof Error ? err.message : "Failed to generate suggestions");
    } finally {
      setIsGeneratingSuggestions(false);
    }
  }, []);

  const fetchSuggestionDetail = useCallback(
    async (suggestion: Suggestion, batchId: string) => {
      const currentSettings = settingsRef.current;
      if (!currentSettings.groqApiKey) return;
      if (suggestion.detail) return; // Already fetched

      const transcript = getRecentTranscript(
        chunksRef.current,
        currentSettings.detailContextWindow
      );

      try {
        const res = await fetch("/api/detail", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            transcript,
            suggestionType: suggestion.type,
            suggestionPreview: suggestion.preview,
            prompt: currentSettings.detailPrompt,
            apiKey: currentSettings.groqApiKey,
          }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to get detail");

        // Update the suggestion in the batch
        setSuggestionBatches((prev) =>
          prev.map((batch) =>
            batch.id === batchId
              ? {
                  ...batch,
                  suggestions: batch.suggestions.map((s) =>
                    s.id === suggestion.id ? { ...s, detail: data.content } : s
                  ),
                }
              : batch
          )
        );
      } catch (err) {
        console.error("Detail error:", err);
      }
    },
    []
  );

  const sendChatMessage = useCallback(
    async (message: string, suggestionId?: string) => {
      const currentSettings = settingsRef.current;
      if (!currentSettings.groqApiKey || !message.trim()) return;

      const userMsg: ChatMessage = {
        id: generateId(),
        role: "user",
        content: message.trim(),
        createdAt: new Date(),
        suggestionId,
      };

      setChatMessages((prev) => {
        const next = [...prev, userMsg];
        chatMessagesRef.current = next;
        return next;
      });
      setIsChatLoading(true);

      const assistantMsgId = generateId();
      const assistantMsg: ChatMessage = {
        id: assistantMsgId,
        role: "assistant",
        content: "",
        createdAt: new Date(),
      };
      setChatMessages((prev) => {
        const next = [...prev, assistantMsg];
        chatMessagesRef.current = next;
        return next;
      });

      try {
        const transcript = getFullTranscript(chunksRef.current);
        const chatHistory = formatChatHistory(
          // Pass recent history excluding the message we just added
          chatMessagesRef.current.slice(-12)
        );

        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            transcript,
            chatHistory,
            userMessage: message.trim(),
            prompt: currentSettings.chatPrompt,
            apiKey: currentSettings.groqApiKey,
          }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error ?? "Chat failed");
        }

        // Stream the response
        const reader = res.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) throw new Error("No response body");

        let buffer = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const payload = line.slice(6);
            if (payload === "[DONE]") break;

            try {
              const { delta } = JSON.parse(payload);
              if (delta) {
                setChatMessages((prev) => {
                  const next = prev.map((m) =>
                    m.id === assistantMsgId
                      ? { ...m, content: m.content + delta }
                      : m
                  );
                  chatMessagesRef.current = next;
                  return next;
                });
              }
            } catch {
              // Skip malformed SSE lines
            }
          }
        }
      } catch (err) {
        console.error("Chat error:", err);
        setChatMessages((prev) => {
          const next = prev.map((m) =>
            m.id === assistantMsgId
              ? {
                  ...m,
                  content:
                    "Sorry, I encountered an error. Please check your API key and try again.",
                }
              : m
          );
          chatMessagesRef.current = next;
          return next;
        });
      } finally {
        setIsChatLoading(false);
      }
    },
    [] // Uses refs for all state access — no stale closure risk
  );

  return {
    transcriptChunks,
    suggestionBatches,
    chatMessages,
    sessionStartTime,
    isTranscribing,
    isGeneratingSuggestions,
    isChatLoading,
    suggestionsError,
    transcribeAudio,
    generateSuggestions,
    fetchSuggestionDetail,
    sendChatMessage,
    startSession,
    endSession,
    clearSession,
    settings,
    updateSettings,
  };
}
