"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Session } from "@/types";
import { formatDate } from "@/lib/utils/formatters";
import type { ParsedAssistantQuery } from "@/lib/assistant/chatbot";
import type { AssistantInsightReport } from "@/lib/assistant/insights";

interface Props {
  sessions: Session[];
}

interface ChatMessage {
  id: string;
  role: "assistant" | "user";
  text: string;
  matches?: Session[];
  parsed?: ParsedAssistantQuery;
  insights?: AssistantInsightReport;
}

const STORAGE_KEY = "calendarproject_v1:assistantHistory";

const QUICK_PROMPTS = [
  "Show India sessions in May",
  "Find communication workshops by Sridatri Panda",
  "How many leadership sessions are available?",
  "Give me business insights on this calendar",
];

function formatUnreadCount(unreadCount: number) {
  if (unreadCount <= 0) return "";
  if (unreadCount > 9) return "9+";
  return String(unreadCount);
}

export function AssistantLitePanel({ sessions }: Props) {
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const scrollAnchorRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLElement | null>(null);
  const footerRef = useRef<HTMLDivElement | null>(null);
  const isOpenRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as ChatMessage[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed);
          return;
        }
      }
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }

    setMessages([
      {
        id: "welcome",
        role: "assistant",
        text: "Hi — I’m the session assistant. Ask me for sessions by region, month, facilitator, audience, or topic, and I’ll suggest the best matches.",
      },
    ]);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || messages.length === 0) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    if (!isOpen) return;
    scrollAnchorRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isSending, isOpen]);

  useEffect(() => {
    isOpenRef.current = isOpen;
    if (isOpen) setUnreadCount(0);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node | null;
      if (!target) return;
      if (panelRef.current?.contains(target)) return;
      if (footerRef.current?.contains(target)) return;
      setIsOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [isOpen]);

  const canSend = query.trim().length > 0 && !isSending;

  async function sendMessage(messageText: string) {
    const trimmed = messageText.trim();
    if (!trimmed) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      text: trimmed,
    };

    setMessages((current) => [...current, userMessage]);
    setQuery("");
    setIsSending(true);

    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed, sessions }),
      });

      const data = await response.json() as {
        reply: string;
        matches: Session[];
        parsed: ParsedAssistantQuery;
        insights?: AssistantInsightReport;
      };

      setMessages((current) => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          text: data.reply,
          matches: data.matches,
          parsed: data.parsed,
          insights: data.insights,
        },
      ]);
      if (!isOpenRef.current) {
        setUnreadCount((current) => current + 1);
      }
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          id: `assistant-error-${Date.now()}`,
          role: "assistant",
          text: `I hit a problem while answering that: ${error instanceof Error ? error.message : String(error)}`,
        },
      ]);
      if (!isOpenRef.current) {
        setUnreadCount((current) => current + 1);
      }
    } finally {
      setIsSending(false);
    }
  }

  async function openAndSendMessage(messageText: string) {
    setIsOpen(true);
    await sendMessage(messageText);
  }

  const parsedHint = useMemo(() => {
    const lastAssistant = [...messages].reverse().find((message) => message.role === "assistant" && message.parsed);
    return lastAssistant?.parsed;
  }, [messages]);
  const unreadLabel = formatUnreadCount(unreadCount);

  const panelClassName = isFullscreen
    ? "fixed inset-4 bottom-24 z-50 flex flex-col overflow-hidden rounded-[28px] border border-white/60 bg-white/95 shadow-[0_30px_70px_rgba(17,32,59,0.24)] backdrop-blur-xl"
    : "fixed bottom-24 right-4 z-50 flex h-[min(72vh,680px)] w-[min(430px,calc(100vw-1rem))] flex-col overflow-hidden rounded-[28px] border border-white/60 bg-white/95 shadow-[0_30px_70px_rgba(17,32,59,0.24)] backdrop-blur-xl";

  return (
    <>
      <div ref={footerRef} className="fixed inset-x-0 bottom-0 z-40 border-t border-white/40 bg-[linear-gradient(90deg,rgba(255,255,255,0.94),rgba(244,248,255,0.96))] backdrop-blur-xl shadow-[0_-14px_36px_rgba(17,32,59,0.12)]">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-slate-900">AI Chat</p>
              {unreadCount > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-0.5 text-[11px] font-semibold text-rose-700 shadow-sm">
                  <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                  {unreadLabel} unread
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500">
              {unreadCount > 0
                ? "New assistant replies are waiting in chat."
                : "Ask for sessions, insights, trends, or business analysis anytime."}
            </p>
          </div>

          <div className="flex flex-1 flex-col gap-2 sm:max-w-3xl sm:flex-row sm:items-center">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask AI about sessions or insights..."
              className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white/95 px-4 py-2.5 text-sm text-slate-700 shadow-[0_8px_20px_rgba(15,23,42,0.05)] outline-none focus:border-[#2876b5] focus:ring-2 focus:ring-[#2876b5]/15"
              onFocus={() => setIsOpen(true)}
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIsOpen((current) => !current)}
                className={`rounded-full px-3.5 py-2 text-sm font-medium transition-colors ${
                  unreadCount > 0
                    ? "border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                    : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                {isOpen ? "Hide Chat" : unreadCount > 0 ? `Open Chat · ${unreadLabel}` : "Open Chat"}
              </button>
              <Link
                href="/insights"
                className="rounded-full border border-indigo-200 bg-indigo-50 px-3.5 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-100"
              >
                Open Insights
              </Link>
              <button
                type="button"
                onClick={() => void openAndSendMessage(query)}
                disabled={!canSend}
                className="rounded-full bg-[linear-gradient(90deg,#3a2aa1,#2876b5)] px-4 py-2 text-sm font-medium text-white shadow-[0_12px_24px_rgba(58,42,161,0.18)] hover:opacity-95 disabled:opacity-60"
              >
                Ask AI
              </button>
            </div>
          </div>
        </div>
      </div>

      {isOpen && (
        <section ref={panelRef} className={panelClassName}>
          <header className="flex items-start justify-between border-b border-white/20 bg-[linear-gradient(120deg,#3a2aa1,#2876b5_60%,#4eb8d7)] px-4 py-4 text-white">
            <div>
              <h2 className="text-base font-semibold text-white">AI Assistant</h2>
              <p className="mt-0.5 text-xs text-white/80">Ask anything about sessions by geo, month, facilitator, or topic.</p>
              <Link href="/insights" className="mt-2 inline-flex text-xs font-medium text-white/90 hover:text-white">
                Open full Insights page →
              </Link>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsFullscreen((current) => !current)}
                className="rounded-full border border-white/30 bg-white/10 px-2.5 py-1 text-xs font-medium text-white hover:bg-white/20"
                aria-label={isFullscreen ? "Exit fullscreen chat" : "Open fullscreen chat"}
              >
                {isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-full border border-white/30 bg-white/10 px-2.5 py-1 text-xs font-medium text-white hover:bg-white/20"
                aria-label="Close AI assistant"
              >
                Close
              </button>
            </div>
          </header>

          <div className="border-b border-slate-100 bg-[linear-gradient(180deg,rgba(243,245,255,0.9),rgba(255,255,255,0.85))] px-3 py-3">
            <div className="flex flex-wrap gap-2">
              {QUICK_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => void openAndSendMessage(prompt)}
                  className="rounded-full border border-indigo-200 bg-white px-3 py-1 text-xs font-medium text-indigo-700 shadow-sm hover:bg-indigo-100"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto bg-[linear-gradient(180deg,#f7f9fd,#eef4fb)] px-3 py-3">
            {messages.map((message) => (
              <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[90%] rounded-2xl px-4 py-3 text-sm shadow-sm ${message.role === "user" ? "bg-[linear-gradient(90deg,#3a2aa1,#2876b5)] text-white" : "border border-white/70 bg-white text-slate-800"}`}>
                  <p>{message.text}</p>
                  {message.parsed && (
                    <p className="mt-2 text-xs text-slate-500">
                      Parsed: {message.parsed.geo ? `Geo=${message.parsed.geo}; ` : ""}
                      {message.parsed.month ? `Month=${message.parsed.month}; ` : ""}
                      {message.parsed.facilitator ? `Facilitator=${message.parsed.facilitator}; ` : ""}
                      Keywords={message.parsed.keywords.length > 0 ? message.parsed.keywords.join(", ") : "none"}
                    </p>
                  )}

                  {message.insights && (
                    <div className="mt-3 space-y-3 rounded-xl border border-indigo-100 bg-indigo-50/50 p-3">
                      <div>
                        <p className="text-sm font-semibold text-indigo-900">{message.insights.headline}</p>
                        <p className="mt-1 text-xs text-indigo-800">{message.insights.summary}</p>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        {message.insights.metrics.map((metric) => (
                          <div key={metric.label} className="rounded-lg border border-indigo-100 bg-white p-2">
                            <p className="text-[11px] text-slate-500">{metric.label}</p>
                            <p className="text-sm font-semibold text-slate-900">{metric.value}</p>
                          </div>
                        ))}
                      </div>

                      <ul className="list-disc space-y-1 pl-4 text-xs text-slate-700">
                        {message.insights.bullets.map((bullet) => (
                          <li key={bullet}>{bullet}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {message.matches && message.matches.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {message.matches.map((session) => (
                        <Link
                          key={session.id}
                          href={`/sessions/${session.id}`}
                          className="block rounded-xl border border-slate-200 p-3 transition-colors hover:border-indigo-300 hover:bg-indigo-50/40"
                        >
                          <p className="text-sm font-medium text-slate-900">{session.programName}</p>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {session.geo ?? "Global"} · {session.facilitator ?? "TBD"} · {formatDate(session.dateISO)}
                          </p>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {isSending && (
              <div className="flex justify-start">
                <div className="rounded-2xl border border-white/70 bg-white px-4 py-3 text-sm text-slate-500 shadow-sm">
                  Thinking…
                </div>
              </div>
            )}
            <div ref={scrollAnchorRef} />
          </div>

          <div className="shrink-0 border-t border-slate-100 bg-white/95 p-3">
            <form className="flex gap-2" onSubmit={(e) => {
              e.preventDefault();
              void sendMessage(query);
            }}>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ask about sessions..."
                className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 shadow-[0_8px_20px_rgba(15,23,42,0.05)] outline-none focus:border-[#2876b5] focus:ring-2 focus:ring-[#2876b5]/15"
              />
              <button
                type="submit"
                disabled={!canSend}
                className="rounded-full bg-[linear-gradient(90deg,#3a2aa1,#2876b5)] px-4 py-2 text-sm font-medium text-white shadow-[0_12px_24px_rgba(58,42,161,0.18)] hover:opacity-95 disabled:opacity-60"
              >
                Send
              </button>
            </form>

            {parsedHint && (
              <div className="mt-2 text-[11px] text-slate-500">
                Last intent: {parsedHint.geo ? `Geo=${parsedHint.geo}; ` : ""}
                {parsedHint.month ? `Month=${parsedHint.month}; ` : ""}
                {parsedHint.facilitator ? `Facilitator=${parsedHint.facilitator}; ` : ""}
                {parsedHint.keywords.length > 0 ? `Keywords=${parsedHint.keywords.join(", ")}` : "Keywords=none"}
              </div>
            )}
          </div>
        </section>
      )}
    </>
  );
}
