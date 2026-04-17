"use client";

import { useEffect, useRef, useState, KeyboardEvent } from "react";
import { ChatMessage, Suggestion } from "../types";
import { SUGGESTION_TYPE_LABELS } from "../lib/defaults";
import { formatTime } from "../lib/utils";

interface ChatPanelProps {
  messages: ChatMessage[];
  isLoading: boolean;
  pendingSuggestion: { suggestion: Suggestion; detail?: string } | null;
  onSendMessage: (message: string, suggestionId?: string) => void;
  onClearPendingSuggestion: () => void;
}

export function ChatPanel({
  messages,
  isLoading,
  pendingSuggestion,
  onSendMessage,
  onClearPendingSuggestion,
}: ChatPanelProps) {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // When a suggestion is clicked — just focus the input, don't pre-fill
  // The suggestion is shown as a badge above the input instead
  useEffect(() => {
    if (pendingSuggestion) {
      setInput("");
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [pendingSuggestion]);

  const handleSend = () => {
    const trimmed = input.trim();
    // If no custom text but a suggestion is pending, send the suggestion itself
    const messageToSend = trimmed ||
      (pendingSuggestion
        ? `${SUGGESTION_TYPE_LABELS[pendingSuggestion.suggestion.type]}: ${pendingSuggestion.suggestion.preview}`
        : "");
    if (!messageToSend || isLoading) return;
    onSendMessage(messageToSend, pendingSuggestion?.suggestion.id);
    setInput("");
    onClearPendingSuggestion();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <span className="text-sm font-semibold text-white/80 uppercase tracking-wider">
          Chat
        </span>
        {messages.length > 0 && (
          <span className="text-xs text-white/30">
            {Math.floor(messages.filter((m) => m.role === "user").length)} question
            {messages.filter((m) => m.role === "user").length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4 scrollbar-thin">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-white/30 gap-3 px-4">
            <ChatIcon className="w-10 h-10 opacity-30" />
            <p className="text-sm">
              Click a suggestion card or type a question to start chatting
            </p>
          </div>
        ) : (
          messages.map((msg) => <MessageBubble key={msg.id} message={msg} />)
        )}
        {isLoading && (
          <div className="flex items-start">
            <TypingIndicator />
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="px-4 py-3 border-t border-white/10">
        {pendingSuggestion && (
          <div className="flex items-center gap-2 mb-2 px-2.5 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20 min-w-0">
            <span className="text-xs text-blue-400 shrink-0">
              {SUGGESTION_TYPE_LABELS[pendingSuggestion.suggestion.type]}
            </span>
            <span className="text-xs text-blue-300/70 truncate flex-1 min-w-0">
              {pendingSuggestion.suggestion.preview}
            </span>
            <button
              onClick={() => {
                onClearPendingSuggestion();
                setInput("");
              }}
              className="text-white/30 hover:text-white/60 transition-colors shrink-0"
              aria-label="Clear suggestion"
            >
              <XIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
        <div className="flex gap-2 items-center">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              pendingSuggestion
                ? "Add a follow-up question or press Send…"
                : "Ask anything about the conversation…"
            }
            rows={2}
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white/90 placeholder-white/25 resize-none focus:outline-none focus:border-blue-500/50 focus:bg-white/8 transition-all scrollbar-thin"
            aria-label="Chat input"
          />
          <button
            onClick={handleSend}
            disabled={(!input.trim() && !pendingSuggestion) || isLoading}
            className="p-2.5 rounded-xl bg-blue-500/20 border border-blue-500/30 text-blue-400 hover:bg-blue-500/30 disabled:opacity-40 disabled:cursor-not-allowed transition-all shrink-0"
            aria-label="Send message"
          >
            <SendIcon className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-white/20 mt-1.5 text-center">
          Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";

  return (
    <div className={`flex flex-col gap-1 ${isUser ? "items-end" : "items-start"}`}>
      <div
        className={`max-w-[92%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
          isUser
            ? "bg-blue-500/20 border border-blue-500/30 text-white/90 rounded-br-sm"
            : "bg-white/5 border border-white/10 text-white/85 rounded-bl-sm"
        }`}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <MarkdownContent content={message.content} />
        )}
      </div>
      <span className="text-xs text-white/25 px-1">
        {formatTime(message.createdAt)}
      </span>
    </div>
  );
}

/** Lightweight markdown renderer: headers, bold, italic, bullets, numbered lists */
function MarkdownContent({ content }: { content: string }) {
  if (!content) {
    return <span className="text-white/30 italic text-xs">Thinking…</span>;
  }

  const lines = content.split("\n");
  return (
    <div className="space-y-1">
      {lines.map((line, i) => {
        if (line.startsWith("### ")) {
          return (
            <p key={i} className="font-semibold text-white/90 text-xs uppercase tracking-wide mt-2 first:mt-0">
              {line.slice(4)}
            </p>
          );
        }
        if (line.startsWith("## ")) {
          return (
            <p key={i} className="font-semibold text-white/90 mt-2 first:mt-0">
              {line.slice(3)}
            </p>
          );
        }
        if (line.startsWith("# ")) {
          return (
            <p key={i} className="font-bold text-white mt-2 first:mt-0">
              {line.slice(2)}
            </p>
          );
        }
        if (line.startsWith("- ") || line.startsWith("* ")) {
          return (
            <p key={i} className="flex gap-1.5">
              <span className="text-white/40 mt-0.5 shrink-0">•</span>
              <span>{renderInline(line.slice(2))}</span>
            </p>
          );
        }
        const numberedMatch = line.match(/^(\d+)\. (.*)$/);
        if (numberedMatch) {
          return (
            <p key={i} className="flex gap-1.5">
              <span className="text-white/40 shrink-0 tabular-nums">{numberedMatch[1]}.</span>
              <span>{renderInline(numberedMatch[2])}</span>
            </p>
          );
        }
        if (line === "") return <div key={i} className="h-1" />;
        return <p key={i}>{renderInline(line)}</p>;
      })}
    </div>
  );
}

function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold text-white">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("*") && part.endsWith("*")) {
      return (
        <em key={i} className="italic text-white/80">
          {part.slice(1, -1)}
        </em>
      );
    }
    return part;
  });
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-2xl rounded-bl-sm">
      <span className="w-1.5 h-1.5 rounded-full bg-white/40 animate-bounce [animation-delay:0ms]" />
      <span className="w-1.5 h-1.5 rounded-full bg-white/40 animate-bounce [animation-delay:150ms]" />
      <span className="w-1.5 h-1.5 rounded-full bg-white/40 animate-bounce [animation-delay:300ms]" />
    </div>
  );
}

function ChatIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
    </svg>
  );
}

function SendIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}
