import { RETIREMENT_INTENTS } from "./intents";
import type { ChatResponse } from "@/types";

const STOP_WORDS = new Set([
  "i", "me", "my", "we", "our", "you", "your", "he", "him", "his", "she",
  "her", "it", "its", "they", "them", "their", "what", "which", "who", "this",
  "that", "these", "those", "am", "is", "are", "was", "were", "be", "been",
  "being", "have", "has", "had", "do", "does", "did", "a", "an", "the", "and",
  "but", "if", "or", "as", "until", "of", "at", "by", "for", "with", "about",
  "to", "from", "in", "out", "on", "off", "then", "when", "where", "why",
  "how", "all", "each", "some", "such", "no", "not", "only", "so", "than",
  "too", "very", "just", "can", "will", "would", "could", "may", "should",
  "get", "like", "go", "make", "want", "need",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOP_WORDS.has(t));
}

// Build vocabulary from all intents' keywords and training examples
function buildVocabulary(): string[] {
  const vocab = new Set<string>();
  RETIREMENT_INTENTS.forEach((intent) => {
    intent.keywords.forEach((k) => vocab.add(k));
    intent.trainingExamples.forEach((ex) => {
      tokenize(ex).forEach((t) => vocab.add(t));
    });
  });
  return Array.from(vocab);
}

function buildVector(tokens: string[], vocabulary: string[]): number[] {
  const freq: Record<string, number> = {};
  tokens.forEach((t) => {
    freq[t] = (freq[t] || 0) + 1;
  });
  return vocabulary.map((v) => freq[v] || 0);
}

function cosineSimilarity(a: number[], b: number[]): number {
  const dot = a.reduce((sum, ai, i) => sum + ai * b[i], 0);
  const magA = Math.sqrt(a.reduce((sum, ai) => sum + ai * ai, 0));
  const magB = Math.sqrt(b.reduce((sum, bi) => sum + bi * bi, 0));
  return magA === 0 || magB === 0 ? 0 : dot / (magA * magB);
}

// Pre-build vocabulary and intent vectors at module load time
const VOCABULARY = buildVocabulary();

const INTENT_VECTORS = RETIREMENT_INTENTS.map((intent) => {
  const allTokens = [
    ...intent.keywords,
    ...intent.trainingExamples.flatMap((ex) => tokenize(ex)),
  ];
  return buildVector(allTokens, VOCABULARY);
});

export function getNLUResponse(message: string): ChatResponse {
  const queryTokens = tokenize(message);
  const queryVector = buildVector(queryTokens, VOCABULARY);

  let bestScore = 0;
  let bestIndex = 0;

  INTENT_VECTORS.forEach((intentVector, i) => {
    const score = cosineSimilarity(queryVector, intentVector);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  });

  const bestIntent = RETIREMENT_INTENTS[bestIndex];

  // Very low confidence — no recognisable tokens at all
  if (bestScore < 0.04) {
    return {
      text: "I'm sorry, I don't understand that query. Please ask about CPF, retirement planning, investments, or life events.",
      outOfScope: true,
      confidence: Math.round(bestScore * 100),
    };
  }

  // Below threshold — NLU guesses nearest intent (demonstrates its weakness)
  if (bestScore < 0.14) {
    return {
      text: "Do you mean you would like to perform the below mentioned actions?",
      intent: bestIntent.name,
      confidence: Math.round(bestScore * 100),
      buttons: bestIntent.templateResponse.buttons,
      outOfScope: false,
    };
  }

  // Clear match
  return {
    text: bestIntent.templateResponse.text,
    intent: bestIntent.name,
    confidence: Math.round(bestScore * 100),
    buttons: bestIntent.templateResponse.buttons,
  };
}
