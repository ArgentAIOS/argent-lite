// Source: Pudding Entertainment guide to the Raspberry Pi AI HAT+ 2 /
// Hailo-10H GenAI Model Zoo — https://pudding.entertainment/raspberry-pi-ai-hat-hailo-10h-genai
// These entries reflect the `.hef` models we expect to support once the
// Hailo-10H is live; they are static metadata with no runtime behavior.

export interface HailoModelCapability {
  contextLen: number;
  quant: string;
  source: string;
}

export const HAILO_MODELS: Record<string, HailoModelCapability> = {
  "llama3-8b-q4": {
    contextLen: 8192,
    quant: "q4",
    source: "hailo-genai-model-zoo",
  },
  "gemma2-2b-q4": {
    contextLen: 8192,
    quant: "q4",
    source: "hailo-genai-model-zoo",
  },
  "phi3-mini-q4": {
    contextLen: 4096,
    quant: "q4",
    source: "hailo-genai-model-zoo",
  },
};
