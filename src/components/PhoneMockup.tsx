"use client";

import { useEffect, useRef } from "react";
import { ChatBubble, TypingIndicator } from "./ChatBubble";
import type { ChatState, ChatbotType } from "@/types";

const ENGINE_LABELS: Record<ChatbotType, string> = {
  nlu: "Traditional Chatbot",
  hybrid: "Hybrid (Traditional + GenAI) Chatbot",
  rag: "Full GenAI Chatbot",
};

const ENGINE_COLORS: Record<ChatbotType, string> = {
  nlu: "text-gray-600",
  hybrid: "text-blue-600",
  rag: "text-ocbc-red",
};

interface PhoneMockupProps {
  type: ChatbotType;
  state: ChatState;
  onButtonClick: (text: string) => void;
}

export function PhoneMockup({ type, state, onButtonClick }: PhoneMockupProps) {
  const chatRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [state.messages, state.isLoading]);

  const hasMessages = state.messages.length > 0;

  return (
    <div className="flex flex-col items-center">
      {/* Phone frame */}
      <div className="relative w-[240px] h-[480px] bg-black rounded-[40px] p-[3px] shadow-2xl">
        <div className="w-full h-full bg-[#F2F2F7] rounded-[38px] overflow-hidden flex flex-col">
          {/* Dynamic island */}
          <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
            <div className="w-20 h-5 bg-black rounded-full" />
          </div>

          {/* Chat area */}
          <div
            ref={chatRef}
            className="flex-1 overflow-y-auto px-2.5 py-2 scroll-smooth"
            style={{ scrollbarWidth: "none" }}
          >
            {!hasMessages && (
              <div className="flex items-center justify-center h-full">
                <p className="text-gray-400 text-xs text-center px-4">
                  Send a message to compare responses
                </p>
              </div>
            )}

            {state.messages.map((msg, i) => (
              <ChatBubble key={i} message={msg} onButtonClick={onButtonClick} />
            ))}

            {state.isLoading && <TypingIndicator />}
          </div>

          {/* Home indicator */}
          <div className="flex justify-center pb-2 pt-1 flex-shrink-0">
            <div className="w-24 h-1 bg-gray-400 rounded-full opacity-60" />
          </div>
        </div>
      </div>

      {/* Latency badge */}
      <div className="mt-2 h-6">
        {state.latency !== undefined ? (
          <span
            className={`text-xs font-mono font-semibold ${
              state.latency < 100
                ? "text-green-600"
                : state.latency < 1500
                ? "text-blue-600"
                : "text-orange-500"
            }`}
          >
            ⏱ {state.latency < 1000
              ? `${state.latency}ms`
              : `${(state.latency / 1000).toFixed(1)}s`}
          </span>
        ) : (
          <span className="text-xs text-transparent">—</span>
        )}
      </div>
    </div>
  );
}
