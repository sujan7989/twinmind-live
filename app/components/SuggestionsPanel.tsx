"use client";

import { SuggestionBatch, Suggestion } from "../types";
import { SUGGESTION_TYPE_LABELS, SUGGESTION_TYPE_COLORS } from "../lib/defaults";
import { formatTime } from "../lib/utils";

interface SuggestionsPanelProps {
  batches: SuggestionBatch[];
  isGenerating: boolean;
  hasTranscript: boolean;
  error: string | null;
  onRefresh: () => void;
  onSuggestionClick: (suggestion: Suggestion, batchId: string) => void;
}

export function SuggestionsPanel({
  batches,
  isGenerating,
  hasTranscript,
  error,
  onRefresh,
  onSuggestionClick,
}: SuggestionsPanelProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-white/80 uppercase tracking-wider">
            Live Suggestions
          </span>
          {isGenerating && (
            <span className="flex items-center gap-1 text-xs text-yellow-400">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
              Thinking
            </span>
          )}
        </div>
        <button
          onClick={onRefresh}
          disabled={isGenerating || !hasTranscript}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/5 border border-white/10 text-white/60 hover:bg-white/10 hover:text-white/80 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          aria-label="Refresh suggestions"
          title="Manually refresh suggestions"
        >
          <RefreshIcon className={`w-3.5 h-3.5 ${isGenerating ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mx-4 mt-3 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400">
          ⚠ {error}
        </div>
      )}

      {/* Suggestions list */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-5 scrollbar-thin">
        {batches.length === 0 ? (
          <EmptyState hasTranscript={hasTranscript} isGenerating={isGenerating} />
        ) : (
          batches.map((batch, batchIndex) => (
            <SuggestionBatchGroup
              key={batch.id}
              batch={batch}
              isLatest={batchIndex === 0}
              onSuggestionClick={onSuggestionClick}
            />
          ))
        )}
      </div>
    </div>
  );
}

function EmptyState({
  hasTranscript,
  isGenerating,
}: {
  hasTranscript: boolean;
  isGenerating: boolean;
}) {
  if (isGenerating) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-2 h-8 bg-yellow-400/30 rounded-full animate-pulse"
              style={{ animationDelay: `${i * 150}ms` }}
            />
          ))}
        </div>
        <p className="text-sm text-white/40">Generating suggestions...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-full text-center text-white/30 gap-3 px-4">
      <LightbulbIcon className="w-10 h-10 opacity-30" />
      <p className="text-sm">
        {hasTranscript
          ? "Click Refresh to generate suggestions based on the transcript"
          : "Start recording — suggestions will appear automatically every 30 seconds"}
      </p>
    </div>
  );
}

interface SuggestionBatchGroupProps {
  batch: SuggestionBatch;
  isLatest: boolean;
  onSuggestionClick: (suggestion: Suggestion, batchId: string) => void;
}

function SuggestionBatchGroup({
  batch,
  isLatest,
  onSuggestionClick,
}: SuggestionBatchGroupProps) {
  return (
    <div className={isLatest ? "animate-fade-slide-in" : ""}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs text-white/30 font-mono">
          {formatTime(batch.createdAt)}
        </span>
        {isLatest && (
          <span className="text-xs bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded-full border border-blue-500/30">
            Latest
          </span>
        )}
      </div>
      <div className="space-y-2">
        {batch.suggestions.map((suggestion) => (
          <SuggestionCard
            key={suggestion.id}
            suggestion={suggestion}
            batchId={batch.id}
            onClick={onSuggestionClick}
          />
        ))}
      </div>
    </div>
  );
}

interface SuggestionCardProps {
  suggestion: Suggestion;
  batchId: string;
  onClick: (suggestion: Suggestion, batchId: string) => void;
}

function SuggestionCard({ suggestion, batchId, onClick }: SuggestionCardProps) {
  const colorClass =
    SUGGESTION_TYPE_COLORS[suggestion.type] ??
    "bg-white/5 border-white/10 text-white/60";
  const label = SUGGESTION_TYPE_LABELS[suggestion.type] ?? suggestion.type;

  return (
    <button
      onClick={() => onClick(suggestion, batchId)}
      className={`w-full text-left p-3.5 rounded-xl border transition-all duration-150 hover:scale-[1.01] hover:brightness-110 active:scale-[0.99] cursor-pointer ${colorClass}`}
      aria-label={`${label}: ${suggestion.preview}`}
    >
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className="text-xs font-semibold opacity-80">{label}</span>
        <ChevronRightIcon className="w-3 h-3 opacity-40 ml-auto shrink-0" />
      </div>
      <p className="text-xs leading-relaxed text-white/80">{suggestion.preview}</p>
    </button>
  );
}

function RefreshIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
    </svg>
  );
}

function LightbulbIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
    </svg>
  );
}

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
    </svg>
  );
}
