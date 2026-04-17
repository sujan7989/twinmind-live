"use client";

import { Suggestion } from "../types";
import { SUGGESTION_TYPE_LABELS, SUGGESTION_TYPE_COLORS } from "../lib/defaults";

interface DetailModalProps {
  suggestion: Suggestion | null;
  batchId: string | null;
  isLoading: boolean;
  onClose: () => void;
  onOpenInChat: (suggestion: Suggestion) => void;
}

export function DetailModal({
  suggestion,
  batchId,
  isLoading,
  onClose,
  onOpenInChat,
}: DetailModalProps) {
  if (!suggestion) return null;

  const colorClass =
    SUGGESTION_TYPE_COLORS[suggestion.type] ??
    "bg-white/5 border-white/10 text-white/60";
  const label = SUGGESTION_TYPE_LABELS[suggestion.type] ?? suggestion.type;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-label={`Detail: ${suggestion.preview}`}
    >
      <div className="bg-[#1a1a2e] border border-white/10 rounded-2xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-white/10 gap-3">
          <div className="flex-1">
            <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border ${colorClass} mb-2`}>
              {label}
            </span>
            <p className="text-sm text-white/85 leading-relaxed">{suggestion.preview}</p>
          </div>
          <button
            onClick={onClose}
            className="text-white/40 hover:text-white/80 transition-colors shrink-0 mt-0.5"
            aria-label="Close"
          >
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 scrollbar-thin">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <div className="w-6 h-6 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" />
              <p className="text-sm text-white/40">Generating detailed response...</p>
            </div>
          ) : suggestion.detail ? (
            <DetailContent content={suggestion.detail} />
          ) : (
            <p className="text-sm text-white/40 italic">No detail available.</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-white/10">
          <p className="text-xs text-white/30">Click to expand in chat for follow-up questions</p>
          <button
            onClick={() => {
              onOpenInChat(suggestion);
              onClose();
            }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium bg-blue-500/20 border border-blue-500/30 text-blue-400 hover:bg-blue-500/30 transition-all"
          >
            <ChatIcon className="w-4 h-4" />
            Open in Chat
          </button>
        </div>
      </div>
    </div>
  );
}

function DetailContent({ content }: { content: string }) {
  const lines = content.split("\n");
  return (
    <div className="space-y-1.5 text-sm text-white/80 leading-relaxed">
      {lines.map((line, i) => {
        if (line.startsWith("### ")) {
          return <p key={i} className="font-semibold text-white/90 text-xs uppercase tracking-wide mt-3 mb-1">{line.slice(4)}</p>;
        }
        if (line.startsWith("## ")) {
          return <p key={i} className="font-semibold text-white mt-3 mb-1">{line.slice(3)}</p>;
        }
        if (line.startsWith("# ")) {
          return <p key={i} className="font-bold text-white text-base mt-3 mb-1">{line.slice(2)}</p>;
        }
        if (line.startsWith("- ") || line.startsWith("* ")) {
          return (
            <p key={i} className="flex gap-2">
              <span className="text-white/40 mt-0.5 shrink-0">•</span>
              <span>{renderInline(line.slice(2))}</span>
            </p>
          );
        }
        if (line.match(/^\d+\. /)) {
          const match = line.match(/^(\d+)\. (.*)$/);
          if (match) {
            return (
              <p key={i} className="flex gap-2">
                <span className="text-white/40 shrink-0">{match[1]}.</span>
                <span>{renderInline(match[2])}</span>
              </p>
            );
          }
        }
        if (line === "") return <div key={i} className="h-1.5" />;
        return <p key={i}>{renderInline(line)}</p>;
      })}
    </div>
  );
}

function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i} className="font-semibold text-white">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("*") && part.endsWith("*")) {
      return <em key={i} className="italic">{part.slice(1, -1)}</em>;
    }
    return part;
  });
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function ChatIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
    </svg>
  );
}
