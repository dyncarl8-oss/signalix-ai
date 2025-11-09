import { GoogleGenAI } from "@google/genai";
import type { TechnicalIndicators } from "./technical-analysis";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface GeminiPredictionDecision {
  direction: "UP" | "DOWN" | "NEUTRAL";
  confidence: number;
  duration: string;
  rationale: string;
  riskFactors: string[];
}

interface TechnicalAnalysisSnapshot {
  pair: string;
  currentPrice: number;
  priceChange24h: number;
  marketRegime: "STRONG_TRENDING" | "TRENDING" | "RANGING";
  upSignals: { category: string; reason: string; strength: number }[];
  downSignals: { category: string; reason: string; strength: number }[];
  upScore: number;
  downScore: number;
  volumeIndicator: number;
  trendStrength: number;
  volatility: number;
  rsiValue: number;
  macdSignal: string;
}

async function callGeminiModel(
  model: string,
  systemPrompt: string,
  analysisText: string,
  schema: any
): Promise<GeminiPredictionDecision | null> {
  const result = await ai.models.generateContent({
    model,
    config: {
      systemInstruction: systemPrompt,
      responseMimeType: "application/json",
      responseSchema: schema,
      temperature: 0.3,
    },
    contents: analysisText,
  });

  if (!result.candidates || result.candidates.length === 0) {
    throw new Error('Empty or invalid response from Gemini');
  }

  const rawJson = result.candidates[0]?.content?.parts?.[0]?.text;

  if (!rawJson) {
    throw new Error('No text content in Gemini response');
  }

  const decision: GeminiPredictionDecision = JSON.parse(rawJson);
  decision.confidence = Math.round(Math.max(90, Math.min(98, decision.confidence)));

  return decision;
}

export async function getGeminiPrediction(
  snapshot: TechnicalAnalysisSnapshot
): Promise<GeminiPredictionDecision | null> {
  const systemPrompt = `You are an elite quantitative crypto trading strategist with deep expertise in technical analysis and short-term price movements.

Your task: Analyze the provided technical indicators and market data to make a precise trading prediction.

CRITICAL REQUIREMENTS:
1. Direction: Choose "UP", "DOWN", or "NEUTRAL" (only use NEUTRAL if truly no edge exists)
2. Confidence: Must be between 90-98%. Use the full range intelligently:
   - 90-92%: Moderate setup with some conflicting signals
   - 93-95%: Strong setup with good alignment
   - 96-98%: Exceptional setup with near-perfect alignment
   IMPORTANT: Vary your confidence naturally - do NOT always return the same value!
3. Duration: Choose from ["10-15 seconds", "15-20 seconds", "20-30 seconds", "30-45 seconds", "45-60 seconds", "1-2 minutes"]
4. Rationale: 2-3 sentences explaining the key factors driving your decision
5. Risk Factors: 2-4 specific risks to this trade

CONFIDENCE CALIBRATION:
- If signals are mixed or market regime is RANGING → 90-92%
- If strong directional bias but some counter-signals → 93-94%
- If very strong alignment and favorable regime → 95-96%
- If exceptional alignment, strong trend, and volume confirmation → 97-98%

Think critically about the data quality and signal alignment. Not every prediction deserves 97%!`;

  const analysisText = `
MARKET SNAPSHOT:
Pair: ${snapshot.pair}
Current Price: $${snapshot.currentPrice.toFixed(2)}
24h Change: ${snapshot.priceChange24h >= 0 ? '+' : ''}${snapshot.priceChange24h.toFixed(2)}%
Market Regime: ${snapshot.marketRegime}

TECHNICAL INDICATORS:
- RSI: ${snapshot.rsiValue.toFixed(1)}
- MACD Signal: ${snapshot.macdSignal}
- Trend Strength: ${snapshot.trendStrength.toFixed(1)}%
- Volume Indicator: ${snapshot.volumeIndicator.toFixed(1)}
- Volatility (ATR): ${snapshot.volatility.toFixed(2)}

SIGNAL ANALYSIS:
UP Signals (Score: ${snapshot.upScore.toFixed(1)}):
${snapshot.upSignals.map(s => `  • ${s.category}: ${s.reason} (${s.strength.toFixed(0)})`).join('\n')}

DOWN Signals (Score: ${snapshot.downScore.toFixed(1)}):
${snapshot.downSignals.map(s => `  • ${s.category}: ${s.reason} (${s.strength.toFixed(0)})`).join('\n')}

Based on this technical analysis, provide your trading decision.`;

  const schema = {
    type: "object",
    properties: {
      direction: { 
        type: "string",
        enum: ["UP", "DOWN", "NEUTRAL"]
      },
      confidence: { 
        type: "number",
        minimum: 90,
        maximum: 98
      },
      duration: { 
        type: "string",
        enum: ["10-15 seconds", "15-20 seconds", "20-30 seconds", "30-45 seconds", "45-60 seconds", "1-2 minutes"]
      },
      rationale: { type: "string" },
      riskFactors: { 
        type: "array",
        items: { type: "string" },
        minItems: 2,
        maxItems: 4
      }
    },
    required: ["direction", "confidence", "duration", "rationale", "riskFactors"]
  };

  try {
    console.log('\n🤖 Calling Gemini 2.5 Pro for prediction...');
    const decision = await callGeminiModel("gemini-2.5-pro", systemPrompt, analysisText, schema);
    
    if (decision) {
      console.log(`✅ Gemini 2.5 Pro Decision: ${decision.direction} | ${decision.confidence}% | ${decision.duration}`);
      console.log(`   Rationale: ${decision.rationale}`);
      return decision;
    }
  } catch (error: any) {
    console.warn(`⚠️  Gemini 2.5 Pro failed: ${error.message}`);
    console.log('🔄 Falling back to Gemini Flash Latest...');
    
    try {
      const decision = await callGeminiModel("gemini-flash-latest", systemPrompt, analysisText, schema);
      
      if (decision) {
        console.log(`✅ Gemini Flash Decision: ${decision.direction} | ${decision.confidence}% | ${decision.duration}`);
        console.log(`   Rationale: ${decision.rationale}`);
        return decision;
      }
    } catch (fallbackError: any) {
      console.error(`❌ Gemini Flash also failed: ${fallbackError.message}`);
      return null;
    }
  }

  return null;
}
