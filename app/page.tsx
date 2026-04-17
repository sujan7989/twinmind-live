"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAudioRecorder } from "./hooks/useAudioRecorder";
import { useSession } from "./hooks/useSession";
import { TranscriptPanel } from "./components/TranscriptPanel";
import { SuggestionsPanel } from "./components/SuggestionsPanel";
import { ChatPanel } from "./components/ChatPanel";
import { DetailModal } from "./components/DetailModal";
import { SettingsModal } from "./components/SettingsModal";
import { DEFAULT_SETTINGS } from "./lib/defaults";
import { buildExportData, exportAsJSON, exportAsText } from "./lib/export";
import { Suggestion, SessionSettings } from "./types";

// Load API key from localStorage on first render
function loadStoredApiKey(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("groq_api_key") ?? "";
}

export default function Home() {
  // ── Settings & API key ──────────────────────────────────────────────────
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showApiKeyBanner, setShowApiKeyBanner] = useState(false);

  // initialSettings is stable — only read once on mount
  const initialSettingsRef = useRef<SessionSettings>({
    ...DEFAULT_SETTINGS,
    groqApiKey: loadStoredApiKey(),
  });

  const session = useSession(initialSettingsRef.current);

  // Show banner if no API key on mount
  useEffect(() => {
    if (!session.settings.groqApiKey) {
      setShowApiKeyBanner(true);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSaveSettings = useCallback(
    (updated: SessionSettings) => {
      session.updateSettings(updated);
      // Persist API key to localStorage (key only, not prompts)
      if (typeof window !== "undefined") {
        localStorage.setItem("groq_api_key", updated.groqApiKey);
      }
      setShowApiKeyBanner(false);
    },
    [session]
  );

  // ── Detail modal state ──────────────────────────────────────────────────
  const [detailSuggestion, setDetailSuggestion] = useState<Suggestion | null>(null);
  const [detailBatchId, setDetailBatchId] = useState<string | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);

  // ── Chat pending suggestion ─────────────────────────────────────────────
  const [pendingSuggestion, setPendingSuggestion] = useState<{
    suggestion: Suggestion;
    detail?: string;
  } | null>(null);

  // Auto-generate suggestions after each new transcript chunk
  const prevChunkCountRef = useRef(0);
  useEffect(() => {
    const count = session.transcriptChunks.length;
    if (count > 0 && count !== prevChunkCountRef.current) {
      prevChunkCountRef.current = count;
      session.generateSuggestions();
    }
  }, [session.transcriptChunks.length, session]);

  // ── Auto-refresh timer ──────────────────────────────────────────────────
  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isRecordingRef = useRef(false);

  const scheduleAutoRefresh = useCallback(
    (intervalSeconds: number) => {
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
      refreshTimerRef.current = setInterval(() => {
        if (isRecordingRef.current) {
          session.generateSuggestions();
        }
      }, intervalSeconds * 1000);
    },
    [session]
  );

  // ── Audio recorder ──────────────────────────────────────────────────────
  const { isRecording, startRecording, stopRecording, error: micError } =
    useAudioRecorder({
      chunkIntervalMs: 30000,
      onChunk: session.transcribeAudio,
    });

  // Keep ref in sync for the auto-refresh callback
  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  // ── Start / stop recording ──────────────────────────────────────────────
  const handleStartRecording = useCallback(async () => {
    if (!session.settings.groqApiKey) {
      setShowApiKeyBanner(true);
      setSettingsOpen(true);
      return;
    }
    session.startSession();
    await startRecording();
    scheduleAutoRefresh(session.settings.refreshIntervalSeconds);
  }, [session, startRecording, scheduleAutoRefresh]);

  const handleStopRecording = useCallback(() => {
    stopRecording();
    if (refreshTimerRef.current) {
      clearInterval(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
    session.endSession();
  }, [stopRecording, session]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
    };
  }, []);

  // ── Suggestion click → open detail modal ───────────────────────────────
  const handleSuggestionClick = useCallback(
    async (suggestion: Suggestion, batchId: string) => {
      setDetailSuggestion(suggestion);
      setDetailBatchId(batchId);

      if (!suggestion.detail) {
        setIsDetailLoading(true);
        await session.fetchSuggestionDetail(suggestion, batchId);
        setIsDetailLoading(false);
      }
    },
    [session]
  );

  // Keep detail modal in sync when suggestion.detail is populated
  useEffect(() => {
    if (!detailSuggestion || !detailBatchId) return;
    const batch = session.suggestionBatches.find((b) => b.id === detailBatchId);
    if (!batch) return;
    const updated = batch.suggestions.find((s) => s.id === detailSuggestion.id);
    if (updated && updated.detail !== detailSuggestion.detail) {
      setDetailSuggestion(updated);
    }
  }, [session.suggestionBatches, detailSuggestion, detailBatchId]);

  // ── Open suggestion in chat ─────────────────────────────────────────────
  const handleOpenInChat = useCallback((suggestion: Suggestion) => {
    setPendingSuggestion({ suggestion, detail: suggestion.detail });
  }, []);

  // ── Manual refresh ──────────────────────────────────────────────────────
  const handleManualRefresh = useCallback(() => {
    session.generateSuggestions();
  }, [session]);

  // ── Export ──────────────────────────────────────────────────────────────
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setExportMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleExport = useCallback(
    (format: "json" | "text") => {
      const data = buildExportData(
        session.transcriptChunks,
        session.suggestionBatches,
        session.chatMessages,
        session.sessionStartTime
      );
      if (format === "json") exportAsJSON(data);
      else exportAsText(data);
      setExportMenuOpen(false);
    },
    [session]
  );

  const hasContent =
    session.transcriptChunks.length > 0 ||
    session.suggestionBatches.length > 0 ||
    session.chatMessages.length > 0;

  return (
    <div className="flex flex-col h-full bg-[#0d0d1a]">
      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-5 py-3 border-b border-white/8 bg-[#0d0d1a]/95 backdrop-blur-sm shrink-0 z-10">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <BrainIcon className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold text-white/90 text-sm tracking-tight">
              TwinMind Live
            </span>
          </div>
          {isRecording && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/15 border border-red-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
              <span className="text-xs text-red-400 font-medium">Live</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Export button */}
          {hasContent && (
            <div className="relative" ref={exportMenuRef}>
              <button
                onClick={() => setExportMenuOpen((v) => !v)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/5 border border-white/10 text-white/60 hover:bg-white/10 hover:text-white/80 transition-all"
                aria-label="Export session"
              >
                <DownloadIcon className="w-3.5 h-3.5" />
                Export
              </button>
              {exportMenuOpen && (
                <div className="absolute right-0 top-full mt-1 w-36 bg-[#1a1a2e] border border-white/10 rounded-xl shadow-xl overflow-hidden z-50">
                  <button
                    onClick={() => handleExport("json")}
                    className="w-full text-left px-3 py-2 text-xs text-white/70 hover:bg-white/8 hover:text-white transition-colors"
                  >
                    Export as JSON
                  </button>
                  <button
                    onClick={() => handleExport("text")}
                    className="w-full text-left px-3 py-2 text-xs text-white/70 hover:bg-white/8 hover:text-white transition-colors"
                  >
                    Export as Text
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Settings button */}
          <button
            onClick={() => setSettingsOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/5 border border-white/10 text-white/60 hover:bg-white/10 hover:text-white/80 transition-all"
            aria-label="Open settings"
          >
            <GearIcon className="w-3.5 h-3.5" />
            Settings
          </button>
        </div>
      </header>

      {/* ── API key banner ───────────────────────────────────────────────── */}
      {showApiKeyBanner && !session.settings.groqApiKey && (
        <div className="flex items-center justify-between px-5 py-2.5 bg-amber-500/10 border-b border-amber-500/20 shrink-0">
          <div className="flex items-center gap-2">
            <KeyIcon className="w-4 h-4 text-amber-400 shrink-0" />
            <p className="text-xs text-amber-300">
              Add your Groq API key to start using TwinMind Live.
            </p>
          </div>
          <button
            onClick={() => setSettingsOpen(true)}
            className="text-xs font-medium text-amber-400 hover:text-amber-300 underline underline-offset-2 transition-colors"
          >
            Add key →
          </button>
        </div>
      )}

      {/* ── Three-column layout ──────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 divide-x divide-white/8">
        {/* Left: Transcript */}
        <div className="w-[28%] min-w-[240px] flex flex-col min-h-0">
          <TranscriptPanel
            chunks={session.transcriptChunks}
            isRecording={isRecording}
            isTranscribing={session.isTranscribing}
            sessionStartTime={session.sessionStartTime}
            onStartRecording={handleStartRecording}
            onStopRecording={handleStopRecording}
            micError={micError}
          />
        </div>

        {/* Middle: Live Suggestions */}
        <div className="w-[36%] flex flex-col min-h-0">
          <SuggestionsPanel
            batches={session.suggestionBatches}
            isGenerating={session.isGeneratingSuggestions}
            hasTranscript={session.transcriptChunks.length > 0}
            error={session.suggestionsError}
            onRefresh={handleManualRefresh}
            onSuggestionClick={handleSuggestionClick}
          />
        </div>

        {/* Right: Chat */}
        <div className="flex-1 flex flex-col min-h-0">
          <ChatPanel
            messages={session.chatMessages}
            isLoading={session.isChatLoading}
            pendingSuggestion={pendingSuggestion}
            onSendMessage={session.sendChatMessage}
            onClearPendingSuggestion={() => setPendingSuggestion(null)}
          />
        </div>
      </div>

      {/* ── Modals ───────────────────────────────────────────────────────── */}
      <DetailModal
        suggestion={detailSuggestion}
        batchId={detailBatchId}
        isLoading={isDetailLoading}
        onClose={() => {
          setDetailSuggestion(null);
          setDetailBatchId(null);
        }}
        onOpenInChat={handleOpenInChat}
      />

      <SettingsModal
        isOpen={settingsOpen}
        settings={session.settings}
        onSave={handleSaveSettings}
        onClose={() => setSettingsOpen(false)}
      />
    </div>
  );
}

// ── Icon components ────────────────────────────────────────────────────────

function BrainIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23-.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
    </svg>
  );
}

function GearIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function DownloadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
    </svg>
  );
}

function KeyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
    </svg>
  );
}
