"use client";

import { useEffect, useRef, useState } from "react";
import { TranscriptChunk } from "../types";
import { formatDuration } from "../lib/utils";

interface TranscriptPanelProps {
  chunks: TranscriptChunk[];
  isRecording: boolean;
  isTranscribing: boolean;
  sessionStartTime: Date | null;
  onStartRecording: () => void;
  onStopRecording: () => void;
  micError: string | null;
}

export function TranscriptPanel({
  chunks,
  isRecording,
  isTranscribing,
  sessionStartTime,
  onStartRecording,
  onStopRecording,
  micError,
}: TranscriptPanelProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new chunks arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chunks]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-white/80 uppercase tracking-wider">
            Transcript
          </span>
          {isTranscribing && (
            <span className="flex items-center gap-1 text-xs text-blue-400">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
              Processing
            </span>
          )}
        </div>
        {sessionStartTime && (
          <SessionTimer startTime={sessionStartTime} isRunning={isRecording} />
        )}
      </div>

      {/* Transcript content */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 scrollbar-thin">
        {chunks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-white/30 gap-3 px-4">
            <MicIcon className="w-10 h-10 opacity-30" />
            <p className="text-sm">
              {isRecording
                ? "Listening… transcript will appear here in ~30 seconds"
                : "Press the mic button to start recording"}
            </p>
          </div>
        ) : (
          chunks.map((chunk) => (
            <div key={chunk.id} className="group">
              <div className="flex items-start gap-2">
                <span className="text-xs text-white/30 mt-0.5 shrink-0 font-mono tabular-nums">
                  {formatDuration(chunk.timestamp)}
                </span>
                <p className="text-sm text-white/85 leading-relaxed">{chunk.text}</p>
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Mic control */}
      <div className="px-4 py-4 border-t border-white/10">
        {micError && (
          <p className="text-xs text-red-400 mb-2 text-center">{micError}</p>
        )}
        <button
          onClick={isRecording ? onStopRecording : onStartRecording}
          className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 ${
            isRecording
              ? "bg-red-500/20 border border-red-500/40 text-red-400 hover:bg-red-500/30 animate-pulse-glow"
              : "bg-blue-500/20 border border-blue-500/40 text-blue-400 hover:bg-blue-500/30"
          }`}
          aria-label={isRecording ? "Stop recording" : "Start recording"}
        >
          {isRecording ? (
            <>
              <StopIcon className="w-4 h-4" />
              Stop Recording
              <span className="flex gap-0.5 ml-1 items-center">
                <span className="w-0.5 h-3 bg-red-400 rounded" style={{ animation: "soundwave 0.8s ease-in-out infinite" }} />
                <span className="w-0.5 h-4 bg-red-400 rounded" style={{ animation: "soundwave 0.8s ease-in-out 0.1s infinite" }} />
                <span className="w-0.5 h-2 bg-red-400 rounded" style={{ animation: "soundwave 0.8s ease-in-out 0.2s infinite" }} />
                <span className="w-0.5 h-4 bg-red-400 rounded" style={{ animation: "soundwave 0.8s ease-in-out 0.3s infinite" }} />
                <span className="w-0.5 h-3 bg-red-400 rounded" style={{ animation: "soundwave 0.8s ease-in-out 0.4s infinite" }} />
              </span>
            </>
          ) : (
            <>
              <MicIcon className="w-4 h-4" />
              Start Recording
            </>
          )}
        </button>
        <p className="text-xs text-white/25 text-center mt-2">
          Transcript updates every ~30 seconds
        </p>
      </div>
    </div>
  );
}

function SessionTimer({
  startTime,
  isRunning,
}: {
  startTime: Date;
  isRunning: boolean;
}) {
  const [elapsed, setElapsed] = useState(() => Date.now() - startTime.getTime());

  useEffect(() => {
    if (!isRunning) return;
    const interval = setInterval(() => {
      setElapsed(Date.now() - startTime.getTime());
    }, 1000);
    return () => clearInterval(interval);
  }, [isRunning, startTime]);

  return (
    <span className="text-xs font-mono text-white/40 tabular-nums">
      {formatDuration(elapsed)}
    </span>
  );
}

function MicIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
    </svg>
  );
}

function StopIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 7.5A2.25 2.25 0 017.5 5.25h9a2.25 2.25 0 012.25 2.25v9a2.25 2.25 0 01-2.25 2.25h-9a2.25 2.25 0 01-2.25-2.25v-9z" />
    </svg>
  );
}
