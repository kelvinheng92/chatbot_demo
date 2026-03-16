"use client";

import type { Message } from "@/types";

interface ChatBubbleProps {
  message: Message;
  onButtonClick?: (text: string) => void;
}

/** Render a markdown string as simple HTML-safe React nodes. */
function renderMarkdown(text: string) {
  return text.split("\n").map((line, i) => {
    // Ordered list: "1. text"
    const orderedMatch = line.match(/^(\d+)\.\s+(.*)/);
    if (orderedMatch) {
      return (
        <p key={i} className="ml-3">
          <span className="font-medium">{orderedMatch[1]}.</span>{" "}
          {renderInline(orderedMatch[2])}
        </p>
      );
    }
    // Unordered list: "- text" or "* text"
    const unorderedMatch = line.match(/^[-*]\s+(.*)/);
    if (unorderedMatch) {
      return (
        <p key={i} className="ml-3 before:content-['•'] before:mr-1.5">
          {renderInline(unorderedMatch[1])}
        </p>
      );
    }
    // Blank line → spacer
    if (line.trim() === "") return <div key={i} className="h-1" />;
    // Normal paragraph
    return <p key={i}>{renderInline(line)}</p>;
  });
}

/** Render inline markdown: **bold** */
function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

export function ChatBubble({ message, onButtonClick }: ChatBubbleProps) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end mb-2">
        <span className="bg-ocbc-red text-white text-xs leading-relaxed rounded-2xl rounded-tr-sm px-3 py-2 max-w-[80%] inline-block">
          {message.content}
        </span>
      </div>
    );
  }

  return (
    <div className="flex justify-start mb-2">
      <div className="max-w-[92%] space-y-1.5">
        <div
          className={`rounded-2xl rounded-tl-sm px-3 py-2 text-xs leading-relaxed space-y-0.5 ${
            message.outOfScope
              ? "bg-gray-100 text-gray-500 border border-gray-200"
              : "bg-white border border-gray-200 text-gray-800 shadow-sm"
          }`}
        >
          {renderMarkdown(message.content)}
        </div>

        {message.buttons && message.buttons.length > 0 && (
          <div className="space-y-1">
            {message.buttons.map((btn, i) => (
              <button
                key={i}
                onClick={() => onButtonClick?.(btn)}
                className="block w-full text-left text-xs text-ocbc-red border border-ocbc-red rounded-full px-3 py-1 hover:bg-red-50 transition-colors duration-150"
              >
                {btn}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function TypingIndicator() {
  return (
    <div className="flex justify-start mb-2">
      <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-3 py-2 shadow-sm">
        <div className="flex gap-1 items-center h-4">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
