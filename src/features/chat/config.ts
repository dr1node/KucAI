export const STORAGE_KEY = "nusa-ai-conversations-v1";
export const PROVIDER_STORAGE_KEY = "nusa-ai-provider-v1";
export const ROUTER_STORAGE_KEY = "kucai-router-settings-v1";
export const WEB_SEARCH_STORAGE_KEY = "kucai-web-search-settings-v1";
export const LANGUAGE_STORAGE_KEY = "kucai-language-v1";
export const THEME_STORAGE_KEY = "kucai-theme-v1";
export const MAX_ATTACHMENTS = 4;
export const MAX_IMAGE_SIZE = 8 * 1024 * 1024;
export const MAX_TEXT_SIZE = 1024 * 1024;
export const MAX_TEXT_CHARS = 30_000;
export const MAX_ATTACHMENT_TOTAL_SIZE = 16 * 1024 * 1024;
export const MIN_SIDEBAR_WIDTH = 220;
export const MAX_SIDEBAR_WIDTH = 420;
export const SIDEBAR_RESIZE_STEP = 16;

export const providerPresets = {
  openai: {
    label: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-4o-mini",
    models: ["gpt-4o-mini", "gpt-4.1-mini", "gpt-4.1"],
  },
  openrouter: {
    label: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    defaultModel: "openai/gpt-4o-mini",
    models: [
      "openai/gpt-4o-mini",
      "anthropic/claude-3.7-sonnet",
      "google/gemini-2.5-flash",
      "deepseek/deepseek-chat",
    ],
  },
  groq: {
    label: "Groq",
    baseUrl: "https://api.groq.com/openai/v1",
    defaultModel: "llama-3.3-70b-versatile",
    models: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"],
  },
  deepseek: {
    label: "DeepSeek",
    baseUrl: "https://api.deepseek.com/v1",
    defaultModel: "deepseek-chat",
    models: ["deepseek-chat", "deepseek-reasoner"],
  },
  gemini: {
    label: "Google Gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    defaultModel: "gemini-2.5-flash",
    models: ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.0-flash"],
  },
  mistral: {
    label: "Mistral",
    baseUrl: "https://api.mistral.ai/v1",
    defaultModel: "mistral-small-latest",
    models: ["mistral-small-latest", "mistral-large-latest", "codestral-latest"],
  },
  ollama: {
    label: "Ollama (lokal)",
    baseUrl: "http://localhost:11434/v1",
    defaultModel: "llama3.2",
    models: ["llama3.2", "qwen2.5:7b", "mistral", "gemma3:4b"],
  },
  custom: {
    label: "Custom (OpenAI-compatible)",
    baseUrl: "",
    defaultModel: "",
    models: [],
  },
} as const;

export type ProviderId = keyof typeof providerPresets;

export const providerAccessLinks: Partial<
  Record<ProviderId, { href: string; label: string }>
> = {
  openai: {
    href: "https://platform.openai.com/api-keys",
    label: "Dapatkan API key OpenAI",
  },
  openrouter: {
    href: "https://openrouter.ai/keys",
    label: "Dapatkan API key OpenRouter",
  },
  groq: {
    href: "https://console.groq.com/keys",
    label: "Dapatkan API key Groq",
  },
  deepseek: {
    href: "https://platform.deepseek.com/api_keys",
    label: "Dapatkan API key DeepSeek",
  },
  gemini: {
    href: "https://aistudio.google.com/apikey",
    label: "Dapatkan API key Google AI Studio",
  },
  mistral: {
    href: "https://console.mistral.ai/api-keys/",
    label: "Dapatkan API key Mistral",
  },
  ollama: {
    href: "https://ollama.com/download",
    label: "Unduh Ollama (tidak perlu API key)",
  },
};

export type ProviderSettings = {
  providerId: ProviderId;
  baseUrl: string;
  model: string;
  apiKey: string;
  rememberApiKey: boolean;
};

export type ApiProfile = ProviderSettings & {
  id: string;
  name: string;
};

export type RouterMode = "single" | "round-robin" | "failover";

export type RouterSettings = {
  mode: RouterMode;
  profiles: ApiProfile[];
};

export type WebSearchSettings = {
  apiKey: string;
  rememberApiKey: boolean;
  topic: WebSearchTopic;
};

export const defaultProviderSettings: ProviderSettings = {
  providerId: "openai",
  baseUrl: providerPresets.openai.baseUrl,
  model: providerPresets.openai.defaultModel,
  apiKey: "",
  rememberApiKey: false,
};

export const defaultRouterSettings: RouterSettings = {
  mode: "single",
  profiles: [],
};

export const defaultWebSearchSettings: WebSearchSettings = {
  apiKey: "",
  rememberApiKey: false,
  topic: "general",
};

export const suggestions = [
  {
    icon: "✦",
    title: "Jelaskan sesuatu",
    prompt: "Jelaskan konsep yang rumit dengan cara yang sederhana",
  },
  {
    icon: "⌘",
    title: "Bantu menulis kode",
    prompt: "Bantu saya merancang dan menulis sebuah fitur aplikasi",
  },
  {
    icon: "↗",
    title: "Cari ide baru",
    prompt: "Berikan beberapa ide kreatif untuk proyek baru",
  },
];

import type { WebSearchTopic } from "./types";

