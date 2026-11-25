import {
  providerPresets,
} from "./config";
import type {
  ApiProfile,
  ProviderId,
  ProviderSettings,
  RouterMode,
  RouterSettings,
  WebSearchSettings,
} from "./config";
import type { CachedState, ChatMessage, Conversation } from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object");
}
function isChatMessage(value: unknown): value is ChatMessage {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    (value.role === "user" || value.role === "assistant") &&
    typeof value.content === "string" &&
    (value.attachments === undefined ||
      (Array.isArray(value.attachments) &&
        value.attachments.every(
          (attachment) =>
            isRecord(attachment) &&
            typeof attachment.id === "string" &&
            typeof attachment.name === "string" &&
            typeof attachment.type === "string" &&
            typeof attachment.size === "number",
        )))
  );
}

function isConversation(value: unknown): value is Conversation {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    typeof value.updatedAt === "string" &&
    (value.pinned === undefined || typeof value.pinned === "boolean") &&
    Array.isArray(value.messages) &&
    value.messages.every(isChatMessage)
  );
}

export function sortConversations(conversations: Conversation[]) {
  return [...conversations].sort(
    (left, right) =>
      Number(right.pinned === true) - Number(left.pinned === true) ||
      new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
  );
}

export function parseCachedState(raw: string): CachedState {
  const parsed: unknown = JSON.parse(raw);
  if (
    !isRecord(parsed) ||
    parsed.version !== 1 ||
    !Array.isArray(parsed.conversations) ||
    !parsed.conversations.every(isConversation) ||
    (parsed.activeId !== null && typeof parsed.activeId !== "string")
  ) {
    throw new Error("Format riwayat lokal tidak dikenali.");
  }

  const conversations = parsed.conversations as Conversation[];
  return {
    conversations: sortConversations(conversations),
    activeId:
      typeof parsed.activeId === "string" &&
      conversations.some((conversation) => conversation.id === parsed.activeId)
        ? parsed.activeId
        : null,
  };
}

export function parseProviderSettings(raw: string): ProviderSettings {
  const parsed: unknown = JSON.parse(raw);
  if (
    !isRecord(parsed) ||
    parsed.version !== 1 ||
    typeof parsed.baseUrl !== "string" ||
    typeof parsed.model !== "string" ||
    typeof parsed.rememberApiKey !== "boolean" ||
    (parsed.apiKey !== undefined && typeof parsed.apiKey !== "string")
  ) {
    throw new Error("Format pengaturan provider tidak dikenali.");
  }

  const providerId: ProviderId =
    typeof parsed.providerId === "string" &&
    Object.prototype.hasOwnProperty.call(providerPresets, parsed.providerId)
      ? (parsed.providerId as ProviderId)
      : (Object.keys(providerPresets).find(
          (id) => parsed.baseUrl === providerPresets[id as ProviderId].baseUrl,
        ) as ProviderId | undefined) ?? "custom";

  return {
    providerId,
    baseUrl: parsed.baseUrl,
    model: parsed.model,
    apiKey: parsed.rememberApiKey && typeof parsed.apiKey === "string" ? parsed.apiKey : "",
    rememberApiKey: parsed.rememberApiKey,
  };
}

export function parseRouterSettings(raw: string): RouterSettings {
  const parsed: unknown = JSON.parse(raw);
  if (
    !isRecord(parsed) ||
    parsed.version !== 1 ||
    !isRouterMode(parsed.mode) ||
    !Array.isArray(parsed.profiles)
  ) {
    throw new Error("Format pengaturan Router AI tidak dikenali.");
  }

  const profileIds = new Set<string>();
  const profiles = parsed.profiles.map((value: unknown): ApiProfile => {
    if (
      !isRecord(value) ||
      typeof value.id !== "string" ||
      profileIds.has(value.id) ||
      typeof value.name !== "string" ||
      typeof value.baseUrl !== "string" ||
      typeof value.model !== "string" ||
      typeof value.rememberApiKey !== "boolean" ||
      !isProviderId(value.providerId) ||
      (value.apiKey !== undefined && typeof value.apiKey !== "string")
    ) {
      throw new Error("Salah satu profil API di Router AI tidak valid.");
    }

    profileIds.add(value.id);
    return {
      id: value.id,
      name: value.name,
      providerId: value.providerId,
      baseUrl: value.baseUrl,
      model: value.model,
      apiKey:
        value.rememberApiKey && typeof value.apiKey === "string"
          ? value.apiKey
          : "",
      rememberApiKey: value.rememberApiKey,
    };
  });

  return {
    mode: parsed.mode,
    profiles,
  };
}

export function parseWebSearchSettings(raw: string): WebSearchSettings {
  const parsed: unknown = JSON.parse(raw);
  if (
    !isRecord(parsed) ||
    parsed.version !== 1 ||
    typeof parsed.rememberApiKey !== "boolean" ||
    (parsed.apiKey !== undefined && typeof parsed.apiKey !== "string") ||
    (parsed.topic !== "general" && parsed.topic !== "news")
  ) {
    throw new Error("Format pengaturan pencarian web tidak dikenali.");
  }

  return {
    apiKey:
      parsed.rememberApiKey && typeof parsed.apiKey === "string"
        ? parsed.apiKey
        : "",
    rememberApiKey: parsed.rememberApiKey,
    topic: parsed.topic,
  };
}

function isRouterMode(value: unknown): value is RouterMode {
  return value === "single" || value === "round-robin" || value === "failover";
}

function isProviderId(value: unknown): value is ProviderId {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(providerPresets, value)
  );
}

