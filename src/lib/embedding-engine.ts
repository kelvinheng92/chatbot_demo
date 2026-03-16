import { pipeline, env } from "@huggingface/transformers";
import { RETIREMENT_INTENTS, OUT_OF_SCOPE_INTENT } from "./intents";
import type { ChatResponse } from "@/types";

// Run in Node.js — download models from HuggingFace Hub, cache to disk
env.allowLocalModels = false;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let extractor: any = null;
let intentEmbeddings: number[][] | null = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getExtractor(): Promise<any> {
  if (!extractor) {
    extractor = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2", {
      dtype: "q8",
    });
  }
  return extractor;
}

async function embed(text: string): Promise<number[]> {
  const ext = await getExtractor();
  const output = await ext(text, { pooling: "mean", normalize: true });
  return Array.from(output.data as Float32Array);
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

// Build one representative embedding per intent by combining its name,
// description and first 5 training examples. Cached after first build.
async function getIntentEmbeddings(): Promise<number[][]> {
  if (!intentEmbeddings) {
    intentEmbeddings = await Promise.all(
      RETIREMENT_INTENTS.map((intent) => {
        const text = [
          intent.name,
          intent.description,
          ...intent.trainingExamples.slice(0, 5),
        ].join(". ");
        return embed(text);
      })
    );
  }
  return intentEmbeddings;
}

// Pre-warm: download model and pre-compute intent embeddings in the background
export async function warmUp(): Promise<void> {
  await getIntentEmbeddings();
}

export interface ClassifyResult {
  intent: (typeof RETIREMENT_INTENTS)[number] | typeof OUT_OF_SCOPE_INTENT;
  score: number;
  outOfScope: boolean;
}

/** Low-level classifier — returns the matched Intent object (or OUT_OF_SCOPE_INTENT). Used by Hybrid and Full GenAI. */
export async function classifyWithEmbedding(message: string): Promise<ClassifyResult> {
  const [queryVec, allIntentVecs] = await Promise.all([
    embed(message),
    getIntentEmbeddings(),
  ]);

  let bestScore = 0;
  let bestIndex = 0;

  allIntentVecs.forEach((vec, i) => {
    const score = cosine(queryVec, vec);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  });

  if (bestScore < WEAK_THRESHOLD) {
    return { intent: OUT_OF_SCOPE_INTENT, score: bestScore, outOfScope: true };
  }

  return {
    intent: RETIREMENT_INTENTS[bestIndex],
    score: bestScore,
    outOfScope: false,
  };
}

const CONFIDENT_THRESHOLD = 0.45; // above → clear retirement match
const WEAK_THRESHOLD = 0.25;      // above → show closest intent (demonstrates misclassification)

export async function getEmbeddingResponse(message: string): Promise<ChatResponse> {
  const [queryVec, allIntentVecs] = await Promise.all([
    embed(message),
    getIntentEmbeddings(),
  ]);

  let bestScore = 0;
  let bestIndex = 0;

  allIntentVecs.forEach((vec, i) => {
    const score = cosine(queryVec, vec);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  });

  const bestIntent = RETIREMENT_INTENTS[bestIndex];

  // Very low similarity — query is unrelated to retirement domain
  if (bestScore < WEAK_THRESHOLD) {
    return {
      text: OUT_OF_SCOPE_INTENT.templateResponse.text,
      buttons: OUT_OF_SCOPE_INTENT.templateResponse.buttons,
      intent: OUT_OF_SCOPE_INTENT.name,
      outOfScope: true,
      confidence: Math.round(bestScore * 100),
    };
  }

  // Below confident threshold — shows nearest intent but likely wrong (key demo moment)
  if (bestScore < CONFIDENT_THRESHOLD) {
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
