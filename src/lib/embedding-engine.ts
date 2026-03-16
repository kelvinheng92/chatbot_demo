import { RETIREMENT_INTENTS, OUT_OF_SCOPE_INTENT } from "./intents";
import type { ChatResponse } from "@/types";

// ---------------------------------------------------------------------------
// Lightweight TF-IDF cosine similarity — no native binaries, Vercel-compatible
// ---------------------------------------------------------------------------

const STOP_WORDS = new Set([
  "a","an","the","is","it","in","on","at","to","for","of","and","or","but",
  "i","my","me","we","you","your","do","be","am","are","was","were","have",
  "has","had","will","can","could","would","should","may","might","what",
  "how","when","where","which","that","this","there","if","about","with",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w));
}

function termFreq(tokens: string[]): Map<string, number> {
  const tf = new Map<string, number>();
  for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
  const total = tokens.length || 1;
  tf.forEach((v, k) => tf.set(k, v / total));
  return tf;
}

// Build global vocabulary + IDF weights from all intent documents
const intentDocs: string[][] = RETIREMENT_INTENTS.map((intent) =>
  tokenize(
    [intent.name, intent.description, ...intent.trainingExamples, ...intent.keywords].join(" ")
  )
);

const vocab: string[] = Array.from(new Set(intentDocs.flat()));
const vocabIndex = new Map(vocab.map((w, i) => [w, i]));

function idf(term: string): number {
  const docsWithTerm = intentDocs.filter((d) => d.includes(term)).length;
  return Math.log((intentDocs.length + 1) / (docsWithTerm + 1)) + 1;
}
const idfCache = new Map(vocab.map((w) => [w, idf(w)]));

function tfidfVector(text: string): number[] {
  const tokens = tokenize(text);
  const tf = termFreq(tokens);
  const vec = new Array(vocab.length).fill(0);
  tf.forEach((tfVal, term) => {
    const idx = vocabIndex.get(term);
    if (idx !== undefined) vec[idx] = tfVal * (idfCache.get(term) ?? 1);
  });
  return vec;
}

function cosine(a: number[], b: number[]): number {
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  return magA === 0 || magB === 0 ? 0 : dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

// Pre-compute intent vectors once at module load (synchronous, no I/O)
const intentVectors: number[][] = intentDocs.map((_, i) =>
  tfidfVector(
    [
      RETIREMENT_INTENTS[i].name,
      RETIREMENT_INTENTS[i].description,
      ...RETIREMENT_INTENTS[i].trainingExamples,
      ...RETIREMENT_INTENTS[i].keywords,
    ].join(" ")
  )
);

// No-op warmUp kept for API compatibility
export async function warmUp(): Promise<void> {}

// ---------------------------------------------------------------------------
// Thresholds
// ---------------------------------------------------------------------------
const CONFIDENT_THRESHOLD = 0.15;
const WEAK_THRESHOLD = 0.05;

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export interface ClassifyResult {
  intent: (typeof RETIREMENT_INTENTS)[number] | typeof OUT_OF_SCOPE_INTENT;
  score: number;
  outOfScope: boolean;
}

export async function classifyWithEmbedding(message: string): Promise<ClassifyResult> {
  const queryVec = tfidfVector(message);

  let bestScore = 0;
  let bestIndex = 0;
  intentVectors.forEach((vec, i) => {
    const score = cosine(queryVec, vec);
    if (score > bestScore) { bestScore = score; bestIndex = i; }
  });

  if (bestScore < WEAK_THRESHOLD) {
    return { intent: OUT_OF_SCOPE_INTENT, score: bestScore, outOfScope: true };
  }
  return { intent: RETIREMENT_INTENTS[bestIndex], score: bestScore, outOfScope: false };
}

export async function getEmbeddingResponse(message: string): Promise<ChatResponse> {
  const queryVec = tfidfVector(message);

  let bestScore = 0;
  let bestIndex = 0;
  intentVectors.forEach((vec, i) => {
    const score = cosine(queryVec, vec);
    if (score > bestScore) { bestScore = score; bestIndex = i; }
  });

  const bestIntent = RETIREMENT_INTENTS[bestIndex];

  if (bestScore < WEAK_THRESHOLD) {
    return {
      text: OUT_OF_SCOPE_INTENT.templateResponse.text,
      buttons: OUT_OF_SCOPE_INTENT.templateResponse.buttons,
      intent: OUT_OF_SCOPE_INTENT.name,
      outOfScope: true,
      confidence: Math.round(bestScore * 100),
    };
  }

  if (bestScore < CONFIDENT_THRESHOLD) {
    return {
      text: "Do you mean you would like to perform the below mentioned actions?",
      intent: bestIntent.name,
      confidence: Math.round(bestScore * 100),
      buttons: bestIntent.templateResponse.buttons,
      outOfScope: false,
    };
  }

  return {
    text: bestIntent.templateResponse.text,
    intent: bestIntent.name,
    confidence: Math.round(bestScore * 100),
    buttons: bestIntent.templateResponse.buttons,
  };
}
