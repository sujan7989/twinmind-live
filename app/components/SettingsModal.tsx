"use client";

import { useState, useEffect } from "react";
import { SessionSettings } from "../types";
import { DEFAULT_SETTINGS } from "../lib/defaults";

interface SettingsModalProps {
  isOpen: boolean;
  settings: SessionSettings;
  onSave: (settings: SessionSettings) => void;
  onClose: () => void;
}

export function SettingsModal({
  isOpen,
  settings,
  onSave,
  onClose,
}: SettingsModalProps) {
  const [local, setLocal] = useState<SessionSettings>(settings);
  const [activeTab, setActiveTab] = useState<"api" | "prompts" | "context">("api");
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    setLocal(settings);
  }, [settings, isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    onSave(local);
    onClose();
  };

  const handleReset = () => {
    setLocal((prev) => ({
      ...prev,
      ...DEFAULT_SETTINGS,
    }));
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-label="Settings"
    >
      <div className="bg-[#1a1a2e] border border-white/10 rounded-2xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <h2 className="text-lg font-semibold text-white">Settings</h2>
          <button
            onClick={onClose}
            className="text-white/40 hover:text-white/80 transition-colors"
            aria-label="Close settings"
          >
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-6 pt-4">
          {(["api", "prompts", "context"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab
                  ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                  : "text-white/40 hover:text-white/60"
              }`}
            >
              {tab === "api" ? "API Key" : tab === "prompts" ? "Prompts" : "Context & Timing"}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 scrollbar-thin">
          {activeTab === "api" && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white/70 mb-1.5">
                  Groq API Key
                </label>
                <div className="relative">
                  <input
                    type={showKey ? "text" : "password"}
                    value={local.groqApiKey}
                    onChange={(e) => setLocal({ ...local, groqApiKey: e.target.value })}
                    placeholder="gsk_..."
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white/90 placeholder-white/25 focus:outline-none focus:border-blue-500/50 pr-10"
                    aria-label="Groq API Key"
                  />
                  <button
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
                    aria-label={showKey ? "Hide API key" : "Show API key"}
                  >
                    {showKey ? <EyeOffIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-xs text-white/30 mt-1.5">
                  Get your key at{" "}
                  <a
                    href="https://console.groq.com/keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:underline"
                  >
                    console.groq.com/keys
                  </a>
                  . Your key is never stored on our servers.
                </p>
              </div>
              <div className="p-3 rounded-xl bg-white/3 border border-white/8 text-xs text-white/40 space-y-1">
                <p className="font-medium text-white/60">Models used:</p>
                <p>• Transcription: <span className="text-white/70">whisper-large-v3</span></p>
                <p>• Suggestions & Chat: <span className="text-white/70">openai/gpt-oss-120b</span></p>
                <p className="mt-2 text-white/30">Your API key is stored only in your browser&apos;s localStorage and never sent to our servers.</p>
              </div>
            </div>
          )}

          {activeTab === "prompts" && (
            <div className="space-y-5">
              <PromptField
                label="Live Suggestions Prompt"
                description="Used to generate the 3 suggestion cards. Use {transcript} and {previousSuggestions} placeholders."
                value={local.suggestionPrompt}
                onChange={(v) => setLocal({ ...local, suggestionPrompt: v })}
                rows={10}
              />
              <PromptField
                label="Suggestion Detail Prompt"
                description="Used when a user clicks a suggestion card. Use {transcript}, {suggestionType}, {suggestionPreview}."
                value={local.detailPrompt}
                onChange={(v) => setLocal({ ...local, detailPrompt: v })}
                rows={8}
              />
              <PromptField
                label="Chat System Prompt"
                description="System prompt for the chat panel. Use {transcript} and {chatHistory}."
                value={local.chatPrompt}
                onChange={(v) => setLocal({ ...local, chatPrompt: v })}
                rows={8}
              />
            </div>
          )}

          {activeTab === "context" && (
            <div className="space-y-4">
              <NumberField
                label="Refresh Interval (seconds)"
                description="How often suggestions auto-refresh while recording"
                value={local.refreshIntervalSeconds}
                min={10}
                max={120}
                onChange={(v) => setLocal({ ...local, refreshIntervalSeconds: v })}
              />
              <NumberField
                label="Suggestion Context Window (characters)"
                description="How much recent transcript to send when generating suggestions"
                value={local.suggestionContextWindow}
                min={500}
                max={16000}
                onChange={(v) => setLocal({ ...local, suggestionContextWindow: v })}
              />
              <NumberField
                label="Detail Context Window (characters)"
                description="How much transcript to send when expanding a suggestion"
                value={local.detailContextWindow}
                min={500}
                max={32000}
                onChange={(v) => setLocal({ ...local, detailContextWindow: v })}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-white/10">
          <button
            onClick={handleReset}
            className="text-sm text-white/40 hover:text-white/60 transition-colors"
          >
            Reset to defaults
          </button>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-sm text-white/60 hover:text-white/80 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-5 py-2 rounded-xl text-sm font-medium bg-blue-500/20 border border-blue-500/30 text-blue-400 hover:bg-blue-500/30 transition-all"
            >
              Save Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PromptField({
  label,
  description,
  value,
  onChange,
  rows = 6,
}: {
  label: string;
  description: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-white/70 mb-1">{label}</label>
      <p className="text-xs text-white/35 mb-2">{description}</p>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white/80 font-mono placeholder-white/25 focus:outline-none focus:border-blue-500/50 resize-y scrollbar-thin"
        spellCheck={false}
      />
    </div>
  );
}

function NumberField({
  label,
  description,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  description: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-white/70 mb-1">{label}</label>
      <p className="text-xs text-white/35 mb-2">{description}</p>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white/90 focus:outline-none focus:border-blue-500/50"
      />
    </div>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function EyeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function EyeOffIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
    </svg>
  );
}
