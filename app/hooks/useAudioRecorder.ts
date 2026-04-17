"use client";

import { useRef, useState, useCallback } from "react";

interface UseAudioRecorderOptions {
  chunkIntervalMs?: number;
  onChunk: (blob: Blob) => void;
}

interface UseAudioRecorderReturn {
  isRecording: boolean;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  error: string | null;
}

export function useAudioRecorder({
  chunkIntervalMs = 30000,
  onChunk,
}: UseAudioRecorderOptions): UseAudioRecorderReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunkTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const flushChunk = useCallback(() => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state === "recording" &&
      chunksRef.current.length > 0
    ) {
      // Stop current recorder to finalize the chunk, then restart
      mediaRecorderRef.current.stop();
    }
  }, []);

  const startNewRecorder = useCallback(
    (stream: MediaStream) => {
      chunksRef.current = [];

      // Pick a supported MIME type
      const mimeType = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/ogg;codecs=opus",
        "audio/mp4",
      ].find((m) => MediaRecorder.isTypeSupported(m)) ?? "";

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        if (chunksRef.current.length > 0) {
          const blob = new Blob(chunksRef.current, {
            type: mimeType || "audio/webm",
          });
          chunksRef.current = [];
          onChunk(blob);
        }

        // If still recording (i.e., this was a periodic flush), restart
        if (streamRef.current && streamRef.current.active) {
          startNewRecorder(streamRef.current);
        }
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
    },
    [onChunk]
  );

  const startRecording = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000,
        },
      });

      streamRef.current = stream;
      startNewRecorder(stream);
      setIsRecording(true);

      // Set up periodic chunk flushing
      chunkTimerRef.current = setInterval(() => {
        flushChunk();
      }, chunkIntervalMs);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Microphone access denied";
      setError(msg);
    }
  }, [chunkIntervalMs, flushChunk, startNewRecorder]);

  const stopRecording = useCallback(() => {
    if (chunkTimerRef.current) {
      clearInterval(chunkTimerRef.current);
      chunkTimerRef.current = null;
    }

    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      // Override onstop to not restart
      mediaRecorderRef.current.onstop = () => {
        if (chunksRef.current.length > 0) {
          const blob = new Blob(chunksRef.current, { type: "audio/webm" });
          chunksRef.current = [];
          onChunk(blob);
        }
      };
      mediaRecorderRef.current.stop();
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    setIsRecording(false);
  }, [onChunk]);

  return { isRecording, startRecording, stopRecording, error };
}
