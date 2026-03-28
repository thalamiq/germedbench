export interface ProviderConfig {
  color: string;
  icon: string; // path to SVG in /public/icons/
}

const PROVIDER_CONFIG: Record<string, ProviderConfig> = {
  Meta: { color: "#0668E1", icon: "/icons/meta.svg" },
  Google: { color: "#34A853", icon: "/icons/google.svg" },
  Mistral: { color: "#F54E42", icon: "/icons/mistral.svg" },
  DeepSeek: { color: "#4D6BFE", icon: "/icons/deepseek.svg" },
  Alibaba: { color: "#FF6A00", icon: "/icons/alibaba.svg" },
  Moonshot: { color: "#E8B931", icon: "/icons/moonshot.svg" },
  OpenAI: { color: "#000000", icon: "/icons/openai.svg" },
  "Swiss AI": { color: "#E42313", icon: "" },
  "Z.ai": { color: "#4A4A4A", icon: "/icons/zai.svg" },
  "OpenGPT-X": { color: "#003399", icon: "" },
};

const FALLBACK: ProviderConfig = { color: "#6b7280", icon: "" };

export function getProviderConfig(provider: string): ProviderConfig {
  return PROVIDER_CONFIG[provider] ?? FALLBACK;
}

export function getProviderIcon(provider: string): string {
  return (PROVIDER_CONFIG[provider] ?? FALLBACK).icon;
}

export function getProviderColor(provider: string): string {
  return (PROVIDER_CONFIG[provider] ?? FALLBACK).color;
}
