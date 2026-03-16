export type ChatbotType = "nlu" | "hybrid" | "rag";

export interface Message {
  role: "user" | "assistant";
  content: string;
  buttons?: string[];
  intent?: string;
  confidence?: number;
  outOfScope?: boolean;
  timestamp: number;
}

export interface ChatState {
  messages: Message[];
  isLoading: boolean;
  latency?: number;
}

export interface ChatRequest {
  message: string;
  type: ChatbotType;
  history: Array<{ role: "user" | "assistant"; content: string }>;
}

export interface ChatResponse {
  text: string;
  intent?: string;
  confidence?: number;
  buttons?: string[];
  outOfScope?: boolean;
  latency?: number;
  error?: boolean;
}
