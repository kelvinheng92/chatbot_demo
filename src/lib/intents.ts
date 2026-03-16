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
