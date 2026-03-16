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

const initialState = (): ChatState => ({ messages: [], isLoading: false });

export default function Home() {
  const [input, setInput] = useState("");
  const [nlu, setNlu] = useState<ChatState>(initialState());
  const [hybrid, setHybrid] = useState<ChatState>(initialState());
  const [rag, setRag] = useState<ChatState>(initialState());
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
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          {/* OCBC Logo */}
          <div className="flex items-center gap-1">
            <div className="w-6 h-6 bg-ocbc-red rounded-sm flex items-center justify-center">
              <span className="text-white text-xs font-bold leading-none">O</span>
            </div>
            <span className="text-ocbc-red font-bold text-lg tracking-tight">OCBC</span>
          </div>
          <div className="w-px h-5 bg-gray-300" />
          <span className="text-gray-700 text-sm font-medium">
            Retirement Chatbot Technology Benchmark
          </span>
        </div>
        <button
          onClick={handleReset}
          className="text-xs text-gray-500 hover:text-gray-800 border border-gray-300 rounded px-3 py-1 transition-colors"
        >
          Reset
        </button>
      </header>

      {/* Main content */}
      <main className="flex-1 flex flex-col items-center py-6 px-4 overflow-hidden">
        {/* Phones row */}
        <div className="flex gap-8 items-start justify-center flex-wrap">
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
      <footer className="bg-white border-t border-gray-200 px-6 py-4 flex-shrink-0">
        {/* Demo query chips */}
        <div className="space-y-2 mb-3">
          <div className="flex gap-2 flex-wrap justify-center items-center">
            <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wide w-full text-center">Simple intent → template response</span>
            {SIMPLE_QUERIES.map((q) => (
              <button
                key={q}
                onClick={() => sendMessage(q)}
                disabled={isAnySending}
                className="text-xs text-gray-600 bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded-full px-3 py-1 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {q}
              </button>
            ))}
          </div>
          <div className="flex gap-2 flex-wrap justify-center items-center">
            <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wide w-full text-center">Complex intent → AI-generated response</span>
            {COMPLEX_QUERIES.map((q) => (
              <button
                key={q}
                onClick={() => sendMessage(q)}
                disabled={isAnySending}
                className="text-xs text-ocbc-red bg-red-50 hover:bg-red-100 border border-red-200 rounded-full px-3 py-1 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        {/* Input bar */}
        <div className="flex items-center gap-3 max-w-2xl mx-auto">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isAnySending}
            placeholder="Type a retirement planning question..."
            className="flex-1 bg-gray-50 border border-gray-300 rounded-full px-4 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-ocbc-red focus:border-transparent disabled:opacity-50"
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={isAnySending || !input.trim()}
            className="bg-ocbc-red text-white rounded-full px-5 py-2.5 text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
          >
            {isAnySending ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Sending
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
