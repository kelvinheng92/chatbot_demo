"use client";

import { useState, useRef, KeyboardEvent } from "react";
import { PhoneMockup } from "@/components/PhoneMockup";
import { EngineInfo } from "@/components/EngineInfo";
import type { ChatState, ChatbotType, ChatResponse, Message } from "@/types";

const SIMPLE_QUERIES = [
  "What is CPF Life and how much will I get?",    // cpf_inquiry
  "Am I on track for retirement?",                // retirement_gap
  "How does buying a home affect my retirement?", // life_events
];

const COMPLEX_QUERIES = [
  "When can I retire in Singapore?",  // retirement_planning
  "Should I open an SRS account?",    // investment_options
];

// EC1: Maps to simple intent → Hybrid returns safe template (no hallucination possible)
//       Full GenAI LLM invents a specific OCBC bonus rate that doesn't exist
const EDGE_QUERIES_1 = [
  "What bonus interest rate does OCBC give on CPF savings for Premier Banking customers?",
];

// EC2: Maps to complex intent → Hybrid also calls LLM → both fabricate specific fund performance figures
const EDGE_QUERIES_2 = [
  "How did OCBC's retirement unit trusts perform versus CPF Life returns over the past 3 years?",
];

const initialState = (): ChatState => ({ messages: [], isLoading: false });

const TAB_LABELS: Record<ChatbotType, string> = {
  nlu: "Traditional",
  hybrid: "Hybrid",
  rag: "Full GenAI",
};

export default function Home() {
  const [input, setInput] = useState("");
  const [nlu, setNlu] = useState<ChatState>(initialState());
  const [hybrid, setHybrid] = useState<ChatState>(initialState());
  const [rag, setRag] = useState<ChatState>(initialState());
  const [activeTab, setActiveTab] = useState<ChatbotType>("nlu");
  const inputRef = useRef<HTMLInputElement>(null);

  const setLoading = (type: ChatbotType, loading: boolean) => {
    const setter = { nlu: setNlu, hybrid: setHybrid, rag: setRag }[type];
    setter((s) => ({ ...s, isLoading: loading }));
  };

  const appendMessage = (type: ChatbotType, msg: Message) => {
    const setter = { nlu: setNlu, hybrid: setHybrid, rag: setRag }[type];
    setter((s) => ({ ...s, messages: [...s.messages, msg], isLoading: false }));
  };

  const setLatency = (type: ChatbotType, latency: number) => {
    const setter = { nlu: setNlu, hybrid: setHybrid, rag: setRag }[type];
    setter((s) => ({ ...s, latency }));
  };

  const getHistory = (state: ChatState) =>
    state.messages.map((m) => ({ role: m.role, content: m.content }));

  const sendToNLU = async (message: string) => {
    setLoading("nlu", true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, type: "nlu", history: [] }),
      });
      const data: ChatResponse = await res.json();
      setLatency("nlu", data.latency ?? 0);
      appendMessage("nlu", {
        role: "assistant",
        content: data.text,
        buttons: data.buttons,
        intent: data.intent,
        confidence: data.confidence,
        outOfScope: data.outOfScope,
        timestamp: Date.now(),
      });
    } catch {
      setLoading("nlu", false);
    }
  };

  const sendToHybrid = async (message: string, userTimestamp: number) => {
    setLoading("hybrid", true);
    const hybridStart = Date.now();
    const placeholderTimestamp = userTimestamp + 2; // offset to avoid collision with user (+1 used by RAG)

    setHybrid((s) => ({
      ...s,
      isLoading: false,
      messages: [
        ...s.messages,
        { role: "assistant", content: "", timestamp: placeholderTimestamp },
      ],
    }));

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, type: "hybrid", history: [] }),
      });

      // Simple intents / OOS return plain JSON
      const contentType = res.headers.get("content-type") ?? "";
      if (contentType.includes("application/json")) {
        const data: ChatResponse = await res.json();
        setLatency("hybrid", data.latency ?? Date.now() - hybridStart);
        setHybrid((s) => ({
          ...s,
          messages: s.messages.map((msg) =>
            msg.timestamp === placeholderTimestamp
              ? { ...msg, content: data.text, buttons: data.buttons, intent: data.intent, confidence: data.confidence, outOfScope: data.outOfScope }
              : msg
          ),
        }));
        return;
      }

      // Complex intents stream via SSE
      let accumulated = "";
      let streamedIntent: string | undefined;
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n").filter((l) => l.startsWith("data: "));

        for (const line of lines) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === "delta") {
              accumulated += data.text;
              if (data.intent) streamedIntent = data.intent;
              setHybrid((s) => ({
                ...s,
                messages: s.messages.map((msg) =>
                  msg.timestamp === placeholderTimestamp
                    ? { ...msg, content: accumulated, intent: streamedIntent }
                    : msg
                ),
              }));
            } else if (data.type === "end") {
              setLatency("hybrid", data.latency ?? Date.now() - hybridStart);
            } else if (data.type === "error") {
              setHybrid((s) => ({
                ...s,
                messages: s.messages.map((msg) =>
                  msg.timestamp === placeholderTimestamp
                    ? { ...msg, content: data.text, outOfScope: true }
                    : msg
                ),
              }));
            }
          } catch {
            // Skip malformed SSE lines
          }
        }
      }
    } catch {
      setHybrid((s) => ({
        ...s,
        messages: s.messages.map((msg) =>
          msg.timestamp === placeholderTimestamp
            ? { ...msg, content: "An error occurred. Please try again.", outOfScope: true }
            : msg
        ),
      }));
    }
  };

  const sendToRAG = async (message: string, currentRagState: ChatState, userTimestamp: number) => {
    setLoading("rag", true);
    const ragStart = Date.now();
    let accumulated = "";

    // Append a streaming placeholder — offset by 1 to guarantee uniqueness vs userTimestamp
    const placeholderTimestamp = userTimestamp + 1;
    setRag((s) => ({
      ...s,
      isLoading: false,
      messages: [
        ...s.messages,
        { role: "assistant", content: "", timestamp: placeholderTimestamp },
      ],
    }));

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          type: "rag",
          history: getHistory(currentRagState),
        }),
      });

      // Out-of-scope returns plain JSON, not SSE
      const contentType = res.headers.get("content-type") ?? "";
      if (contentType.includes("application/json")) {
        const data: ChatResponse = await res.json();
        setLatency("rag", data.latency ?? Date.now() - ragStart);
        setRag((s) => ({
          ...s,
          messages: s.messages.map((msg) =>
            msg.timestamp === placeholderTimestamp
              ? { ...msg, content: data.text, outOfScope: data.outOfScope }
              : msg
          ),
        }));
        return;
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n").filter((l) => l.startsWith("data: "));

        for (const line of lines) {
          try {
            const data = JSON.parse(line.slice(6));

            if (data.type === "delta") {
              accumulated += data.text;
              setRag((s) => ({
                ...s,
                messages: s.messages.map((msg) =>
                  msg.timestamp === placeholderTimestamp
                    ? { ...msg, content: accumulated }
                    : msg
                ),
              }));
            } else if (data.type === "end") {
              setLatency("rag", data.latency ?? Date.now() - ragStart);
            } else if (data.type === "error") {
              setRag((s) => ({
                ...s,
                messages: s.messages.map((msg) =>
                  msg.timestamp === placeholderTimestamp
                    ? { ...msg, content: data.text, outOfScope: true }
                    : msg
                ),
              }));
            }
          } catch {
            // Skip malformed SSE lines
          }
        }
      }
    } catch {
      setRag((s) => ({
        ...s,
        messages: s.messages.map((msg) =>
          msg.timestamp === placeholderTimestamp
            ? { ...msg, content: "An error occurred. Please try again.", outOfScope: true }
            : msg
        ),
      }));
    }
  };

  const sendMessage = async (message: string) => {
    const trimmed = message.trim();
    if (!trimmed) return;

    setInput("");

    const userMsg: Message = { role: "user", content: trimmed, timestamp: Date.now() };

    // Snapshot current rag state for history before we add the new user message
    const currentRagState = { ...rag };

    // Add user message to all three chats
    setNlu((s) => ({ ...s, messages: [...s.messages, userMsg] }));
    setHybrid((s) => ({ ...s, messages: [...s.messages, userMsg] }));
    setRag((s) => ({ ...s, messages: [...s.messages, userMsg] }));

    // Fire all three independently so responses appear as they arrive
    sendToNLU(trimmed);
    sendToHybrid(trimmed, userMsg.timestamp);
    sendToRAG(trimmed, currentRagState, userMsg.timestamp);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const handleReset = () => {
    setNlu(initialState());
    setHybrid(initialState());
    setRag(initialState());
    setInput("");
    inputRef.current?.focus();
  };

  const isAnySending = nlu.isLoading || hybrid.isLoading || rag.isLoading;

  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 sm:px-6 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          {/* OCBC Logo */}
          <img src="/ocbc.png" alt="OCBC" className="h-8 object-contain flex-shrink-0" />
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
          <button
            onClick={handleReset}
            className="text-xs text-gray-600 hover:text-gray-800 border border-gray-300 rounded-full px-3 py-1.5 transition-colors"
          >
            Reset chat
          </button>
          <button className="text-xs text-ocbc-red hover:bg-red-50 border border-ocbc-red rounded-full px-3 py-1.5 transition-colors flex items-center gap-1.5">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Sign out
          </button>
        </div>
      </header>

      {/* Red banner */}
      <div className="bg-ocbc-red px-4 sm:px-6 py-4 flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-white font-bold text-lg leading-tight">WoW Buddy Retirement Chatbot</h1>
        </div>
        <div className="flex items-center gap-2 bg-white/20 rounded-full px-3 py-1.5">
          <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
          <span className="text-white text-xs font-medium">Live</span>
        </div>
      </div>

      {/* Mobile tab switcher */}
      <div className="md:hidden bg-white border-b border-gray-200 flex">
        {(["nlu", "hybrid", "rag"] as ChatbotType[]).map((type) => (
          <button
            key={type}
            onClick={() => setActiveTab(type)}
            className={`flex-1 py-2.5 text-xs font-medium transition-colors border-b-2 ${
              activeTab === type
                ? "border-ocbc-red text-ocbc-red"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {TAB_LABELS[type]}
          </button>
        ))}
      </div>

      {/* Main content */}
      <main className="flex-1 flex flex-col items-center py-4 sm:py-6 px-4 overflow-hidden">
        {/* Mobile: single active chatbot */}
        <div className="md:hidden flex flex-col items-center w-full">
          {(["nlu", "hybrid", "rag"] as ChatbotType[]).map((type) => {
            const state = { nlu, hybrid, rag }[type];
            return (
              <div key={type} className={type === activeTab ? "flex flex-col items-center w-full" : "hidden"}>
                <PhoneMockup
                  type={type}
                  state={state}
                  onButtonClick={(text) => sendMessage(text)}
                />
                <EngineInfo type={type} />
              </div>
            );
          })}
        </div>

        {/* Desktop: three-column layout */}
        <div className="hidden md:flex gap-8 items-start justify-center flex-wrap">
          {(["nlu", "hybrid", "rag"] as ChatbotType[]).map((type) => {
            const state = { nlu, hybrid, rag }[type];
            return (
              <div key={type} className="flex flex-col items-center">
                <PhoneMockup
                  type={type}
                  state={state}
                  onButtonClick={(text) => sendMessage(text)}
                />
                <EngineInfo type={type} />
              </div>
            );
          })}
        </div>
      </main>

      {/* Footer: demo chips + input */}
      <footer className="bg-white border-t border-gray-200 px-4 py-3 sm:py-4 flex-shrink-0">
        {/* Demo query chips — horizontally scrollable on mobile */}
        <div className="space-y-2 mb-3">
          <div className="flex gap-2 items-center overflow-x-auto pb-1 sm:flex-wrap sm:justify-center sm:overflow-x-visible">
            <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wide flex-shrink-0 sm:w-full sm:text-center">Simple →</span>
            {SIMPLE_QUERIES.map((q) => (
              <button
                key={q}
                onClick={() => sendMessage(q)}
                disabled={isAnySending}
                className="text-xs text-gray-600 bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded-full px-3 py-1 transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap flex-shrink-0"
              >
                {q}
              </button>
            ))}
          </div>
          <div className="flex gap-2 items-center overflow-x-auto pb-1 sm:flex-wrap sm:justify-center sm:overflow-x-visible">
            <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wide flex-shrink-0 sm:w-full sm:text-center">Complex →</span>
            {COMPLEX_QUERIES.map((q) => (
              <button
                key={q}
                onClick={() => sendMessage(q)}
                disabled={isAnySending}
                className="text-xs text-ocbc-red bg-red-50 hover:bg-red-100 border border-red-200 rounded-full px-3 py-1 transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap flex-shrink-0"
              >
                {q}
              </button>
            ))}
          </div>
          <div className="flex gap-2 items-center overflow-x-auto pb-1 sm:flex-wrap sm:justify-center sm:overflow-x-visible">
            <span className="text-[10px] font-medium text-amber-600 uppercase tracking-wide flex-shrink-0 sm:w-full sm:text-center">Edge case: Hybrid ✓ · GenAI hallucinates ✗</span>
            {EDGE_QUERIES_1.map((q) => (
              <button
                key={q}
                onClick={() => sendMessage(q)}
                disabled={isAnySending}
                className="text-xs text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-400 rounded-full px-3 py-1 transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap flex-shrink-0"
              >
                {q}
              </button>
            ))}
          </div>
          <div className="flex gap-2 items-center overflow-x-auto pb-1 sm:flex-wrap sm:justify-center sm:overflow-x-visible">
            <span className="text-[10px] font-medium text-rose-600 uppercase tracking-wide flex-shrink-0 sm:w-full sm:text-center">Edge case: Both Hybrid & GenAI hallucinate ✗</span>
            {EDGE_QUERIES_2.map((q) => (
              <button
                key={q}
                onClick={() => sendMessage(q)}
                disabled={isAnySending}
                className="text-xs text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-300 rounded-full px-3 py-1 transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap flex-shrink-0"
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        {/* Input bar */}
        <div className="flex items-center gap-2 sm:gap-3 max-w-2xl mx-auto">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isAnySending}
            placeholder="Ask a retirement question..."
            className="flex-1 bg-gray-50 border border-gray-300 rounded-full px-4 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-ocbc-red focus:border-transparent disabled:opacity-50"
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={isAnySending || !input.trim()}
            className="bg-ocbc-red text-white rounded-full px-4 sm:px-5 py-2.5 text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
          >
            {isAnySending ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                <span className="hidden sm:inline">Sending</span>
              </span>
            ) : (
              "Send"
            )}
          </button>
        </div>
      </footer>
    </div>
  );
}
