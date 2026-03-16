export interface Intent {
  id: string;
  name: string;
  description: string;
  keywords: string[];
  trainingExamples: string[];
  templateResponse: {
    text: string;
    buttons: string[];
  };
}

export const RETIREMENT_INTENTS: Intent[] = [
  {
    id: "cpf_inquiry",
    name: "CPF Inquiry",
    description: "Questions about CPF accounts, interest rates, and contribution rules",
    keywords: [
      "cpf", "central", "provident", "fund", "ordinary", "special", "medisave",
      "oa", "sa", "ma", "ra", "contribution", "payout", "withdrawal", "topup",
      "interest", "rate", "retirement", "account", "life", "balance", "scheme",
    ],
    trainingExamples: [
      "how does CPF work",
      "what is CPF OA interest rate",
      "CPF contribution rates for employees",
      "what is CPF Life monthly payout",
      "when can I withdraw my CPF",
      "how to top up CPF special account",
      "CPF retirement sum requirements",
      "difference between BRS FRS ERS",
      "how much is CPF Life payout",
    ],
    templateResponse: {
      text: "I can help with your CPF queries. What would you like to know?",
      buttons: [
        "CPF OA/SA Interest Rates",
        "CPF Contribution Rates",
        "CPF Life Monthly Payouts",
        "CPF Retirement Sum (BRS/FRS/ERS)",
      ],
    },
  },
  {
    id: "retirement_planning",
    name: "Retirement Planning",
    description: "Planning retirement age, income needs, and retirement goals",
    keywords: [
      "retire", "retirement", "early", "age", "financial", "freedom", "goal",
      "plan", "planning", "income", "need", "much", "when", "comfortably",
      "55", "60", "62", "63", "65", "lifestyle", "comfortable", "target",
    ],
    trainingExamples: [
      "when can I retire",
      "how much do I need to retire comfortably",
      "I want to retire at 55",
      "what is the retirement age in Singapore",
      "how to plan for retirement at 40",
      "how much monthly income do I need in retirement",
      "retire early in Singapore",
      "how much to save for retirement",
      "retirement goal planning",
    ],
    templateResponse: {
      text: "Let me help you plan your retirement. Here are key areas to explore:",
      buttons: [
        "Calculate My Retirement Needs",
        "Singapore Retirement Age Guide",
        "Monthly Income Planning",
        "Start My Retirement Plan",
      ],
    },
  },
  {
    id: "retirement_gap",
    name: "Retirement Gap",
    description: "Calculating shortfall between current savings and retirement target",
    keywords: [
      "gap", "shortfall", "enough", "savings", "short", "more", "insufficient",
      "track", "behind", "deficit", "difference", "close", "bridge", "narrow",
      "afford", "fall", "behind", "catch", "up",
    ],
    trainingExamples: [
      "do I have enough savings for retirement",
      "how to close my retirement gap",
      "I have a retirement shortfall",
      "how much more do I need to save",
      "am I on track for retirement",
      "calculate my retirement deficit",
      "how to narrow the retirement gap",
      "afford to retire at 63",
    ],
    templateResponse: {
      text: "Let me help you assess your retirement gap. What would you like to do?",
      buttons: [
        "Calculate My Retirement Gap",
        "Top Up CPF Special Account",
        "Invest to Close the Gap",
        "Review My Savings Plan",
      ],
    },
  },
  {
    id: "investment_options",
    name: "Investment Options",
    description: "Retirement investments including SRS, unit trusts, and annuities",
    keywords: [
      "invest", "investment", "unit", "trust", "srs", "supplementary", "scheme",
      "endowment", "annuity", "robo", "portfolio", "return", "growth", "risk",
      "fund", "etf", "stock", "bond", "diversify", "product", "savings",
    ],
    trainingExamples: [
      "what investment options do I have for retirement",
      "how to invest for retirement in Singapore",
      "should I use SRS account",
      "OCBC investment products for retirement",
      "low risk investment for retirees",
      "best way to grow retirement savings",
      "unit trust for retirement planning",
      "SRS tax savings",
    ],
    templateResponse: {
      text: "Here are retirement investment options available through OCBC:",
      buttons: [
        "SRS (Tax-Advantaged Savings)",
        "Unit Trusts & ETFs",
        "Endowment & Annuity Plans",
        "OCBC RoboInvest",
      ],
    },
  },
  {
    id: "life_events",
    name: "Life Events Planning",
    description: "Planning major milestones and their impact on retirement",
    keywords: [
      "life", "event", "marriage", "wedding", "children", "child", "education",
      "property", "home", "house", "buy", "family", "travel", "milestone",
      "dream", "car", "kids", "school", "university", "goal", "micro",
    ],
    trainingExamples: [
      "planning to get married soon",
      "saving for my children university education",
      "buying a house impact on retirement",
      "how do life events affect my retirement plan",
      "planning for family expenses and retirement",
      "dream home and retirement savings",
      "micro retirement planning",
      "travel goals and retirement savings",
    ],
    templateResponse: {
      text: "Life events significantly impact your retirement. Which are you planning for?",
      buttons: [
        "Marriage & Family Planning",
        "Children's Education Fund",
        "Property Purchase Impact",
        "Travel & Lifestyle Goals",
      ],
    },
  },
];

export const OUT_OF_SCOPE_DECLINE =
  "Sorry, I don't have the privilege to respond to this question. I'm specialised in retirement planning. I can help you with CPF, retirement goals, investment options, and life events planning.";

// Pre-generated hallucination responses for demo edge cases.
// These ensure the demo reliably shows hallucination rather than depending on LLM behaviour.

// EC1: Full GenAI hallucinates an OCBC CPF bonus product that doesn't exist.
//      Hybrid is safe because cpf_inquiry maps to a template (no LLM involved).
export const RAG_HALLUCINATION_CACHE: Record<string, string> = {
  "What bonus interest rate does OCBC give on CPF savings for Premier Banking customers?":
    "Great news for Premier Banking customers! OCBC offers an exclusive **bonus of 1.5% p.a.** on top of your CPF Ordinary Account's standard 2.5%, effectively bringing your CPF-OA rate to **4.0% p.a.** — matching your Special Account rate.\n\nTo qualify, simply maintain SGD 200,000 or more in eligible OCBC deposits or assets under management. The bonus is applied automatically once you link your CPF account via OCBC internet banking. Would you like me to walk you through the steps to activate this benefit?",
};

// EC2: Both Hybrid and Full GenAI hallucinate specific fund names and performance figures.
//      investment_options is a complex intent, so Hybrid also calls an LLM.
export const HYBRID_HALLUCINATION_CACHE: Record<string, string> = {
  "How did OCBC's retirement unit trusts perform versus CPF Life returns over the past 3 years?":
    "OCBC's retirement unit trusts have delivered an impressive average annualised return of **7.8% p.a.** over the last 3 years for balanced-risk profiles — well ahead of CPF Life's effective yield of ~4.0% p.a.\n\nOur standout performer, the **OCBC Lion Global Retirement Income Fund**, posted **9.2% returns in 2023** alone. While these returns are not guaranteed, they demonstrate the growth potential of actively managed funds. Shall I help you assess the right split between CPF Life and OCBC's investment products for your retirement?",
};

// Full GenAI uses the same hallucinated EC2 response as Hybrid for consistency
Object.assign(RAG_HALLUCINATION_CACHE, HYBRID_HALLUCINATION_CACHE);

export const OUT_OF_SCOPE_INTENT = {
  id: "out_of_scope",
  name: "Out of Scope",
  description: "Query is unrelated to retirement planning",
  templateResponse: {
    text: "I'm specialised in retirement planning and can't help with that topic. Here's what I can assist you with:",
    buttons: [
      "CPF & Retirement Accounts",
      "Retirement Planning Goals",
      "Close My Retirement Gap",
      "Investment Options",
    ],
  },
};
