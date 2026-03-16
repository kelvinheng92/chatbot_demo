import type { ChatbotType } from "@/types";

interface EngineData {
  name: string;
  description: string;
  tags: Array<{ label: string; color: string }>;
  pros: string[];
  cons: string[];
}

const ENGINE_DATA: Record<ChatbotType, EngineData> = {
  nlu: {
    name: "Traditional Chatbot",
    description:
      "TF-IDF vectors with cosine similarity matched against 5 fixed retirement intents.",
    tags: [
      { label: "Deterministic", color: "bg-gray-100 text-gray-600 border-gray-300" },
      { label: "Low latency", color: "bg-green-50 text-green-700 border-green-300" },
    ],
    pros: [
      "Predictable & low risk",
      "Fast response",
    ],
    cons: [
      "Least flexible",
      "Worst customer experience",
    ],
  },
  hybrid: {
    name: "Hybrid (Traditional + GenAI) Chatbot",
    description:
      "Embedding classifier routes simple intents to templates; complex intents to LLM-generated answers.",
    tags: [
      { label: "Multi-language", color: "bg-blue-50 text-blue-700 border-blue-300" },
      { label: "Multi-intent", color: "bg-purple-50 text-purple-700 border-purple-300" },
    ],
    pros: [
      "More flexible while retaining control in critical conversations",
    ],
    cons: [
      "Requires maintenance on critical conversations and rules",
    ],
  },
  rag: {
    name: "Full GenAI Chatbot",
    description:
      "LLM with retirement knowledge base delivering free-form answers scoped to retirement topics.",
    tags: [
      { label: "Knowledge-grounded", color: "bg-red-50 text-ocbc-red border-red-300" },
      { label: "RAG-style", color: "bg-orange-50 text-orange-700 border-orange-300" },
    ],
    pros: [
      "Most flexible",
      "Least maintenance effort",
    ],
    cons: [
      "Significant investment to control risk",
      "Residual risk is higher",
    ],
  },
};

export function EngineInfo({ type }: { type: ChatbotType }) {
  const data = ENGINE_DATA[type];

  return (
    <div className="w-[240px] mt-3 space-y-2">
      <div>
        <p className="text-sm font-semibold text-gray-900">{data.name}</p>
        <p className="text-xs text-gray-500 mt-0.5 leading-snug">{data.description}</p>
      </div>

      <div className="space-y-0.5">
        {data.pros.map((pro) => (
          <p key={pro} className="text-xs text-gray-600 flex gap-1">
            <span className="text-green-500 flex-shrink-0">+</span>
            <span>{pro}</span>
          </p>
        ))}
        {data.cons.map((con) => (
          <p key={con} className="text-xs text-gray-500 flex gap-1">
            <span className="text-red-400 flex-shrink-0">−</span>
            <span>{con}</span>
          </p>
        ))}
      </div>
    </div>
  );
}
