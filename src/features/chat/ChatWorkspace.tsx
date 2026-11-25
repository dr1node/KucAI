"use client";

import Link from "next/link";
import Image from "next/image";
import type {
  ChangeEvent,
  CSSProperties,
  FormEvent,
  KeyboardEvent,
  PointerEvent,
} from "react";
import { useEffect, useRef, useState } from "react";
import {
  AttachmentCard,
  Icon,
  MarkdownText,
} from "./ChatPrimitives";
import {
  defaultProviderSettings,
  defaultRouterSettings,
  defaultWebSearchSettings,
  MAX_ATTACHMENTS,
  MAX_ATTACHMENT_TOTAL_SIZE,
  MAX_IMAGE_SIZE,
  MAX_SIDEBAR_WIDTH,
  MAX_TEXT_CHARS,
  MAX_TEXT_SIZE,
  MIN_SIDEBAR_WIDTH,
  LANGUAGE_STORAGE_KEY,
  providerPresets,
  PROVIDER_STORAGE_KEY,
  ROUTER_STORAGE_KEY,
  SIDEBAR_RESIZE_STEP,
  STORAGE_KEY,
  suggestions,
  THEME_STORAGE_KEY,
  WEB_SEARCH_STORAGE_KEY,
} from "./config";
import {
  ApiSettingsDialog,
  RouterSettingsDialog,
  SettingsMenuDialog,
  WebSearchSettingsDialog,
} from "./SettingsDialogs";
import type {
  ProviderSettings,
  RouterSettings,
  WebSearchSettings,
} from "./config";
import {
  createApiMessage,
  formatWebSearchContext,
  formatWebSearchSources,
  requestCompletion,
  requestWebSearch,
} from "./api";
import {
  parseCachedState,
  parseProviderSettings,
  parseRouterSettings,
  parseWebSearchSettings,
  sortConversations,
} from "./storage";
import type {
  ApiChatMessage,
  AttachmentMeta,
  ChatMessage,
  ColorTheme,
  Conversation,
  Language,
  SettingsSection,
} from "./types";
import { LanguageContext, localize } from "./i18n";
import {
  clearAttachments,
  deleteAttachments,
  getAttachment,
  saveAttachment,
} from "@/lib/local-attachments";

type PendingAttachment = {
  meta: AttachmentMeta;
  file: File;
  textContent?: string;
  previewUrl?: string;
};

type SpeechResult = ArrayLike<{ transcript: string }> & { isFinal: boolean };
type SpeechResultEvent = {
  resultIndex: number;
  results: ArrayLike<SpeechResult>;
};
type SpeechErrorEvent = Event & { error?: string };
type BrowserSpeechRecognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechResultEvent) => void) | null;
  onerror: ((event: SpeechErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};
type SpeechWindow = Window & {
  SpeechRecognition?: new () => BrowserSpeechRecognition;
  webkitSpeechRecognition?: new () => BrowserSpeechRecognition;
};

type WorkspaceStyle = CSSProperties & {
  "--sidebar-width": string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object");
}

function getProviderHost(baseUrl: string) {
  try {
    return new URL(baseUrl).host || "Provider API";
  } catch {
    return "Provider API";
  }
}

function getAttachmentKind(file: File): "image" | "text" | null {
  const extension = file.name.split(".").pop()?.toLowerCase();
  const imageTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  if (
    imageTypes.includes(file.type.toLowerCase()) ||
    (file.type === "" && ["jpg", "jpeg", "png", "webp", "gif"].includes(extension ?? ""))
  ) {
    return "image";
  }
  if (
    file.type.startsWith("text/") ||
    file.type === "application/json" ||
    ["txt", "md", "csv", "json", "xml"].includes(extension ?? "")
  ) {
    return "text";
  }
  return null;
}

function getAttachmentType(file: File) {
  if (file.type) return file.type;
  const extension = file.name.split(".").pop()?.toLowerCase();
  const imageTypes: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    gif: "image/gif",
  };
  return imageTypes[extension ?? ""] ?? "text/plain";
}

export function ChatWorkspace() {
  const [language, setLanguage] = useState<Language>("id");
  const [theme, setTheme] = useState<ColorTheme>("light");
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [error, setError] = useState("");
  const [loadingCache, setLoadingCache] = useState(true);
  const [cacheBlocked, setCacheBlocked] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(272);
  const [openConversationMenuId, setOpenConversationMenuId] = useState<string | null>(null);
  const [renamingConversationId, setRenamingConversationId] = useState<string | null>(null);
  const [conversationTitleDraft, setConversationTitleDraft] = useState("");
  const [providerSettings, setProviderSettings] = useState(defaultProviderSettings);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsSection, setSettingsSection] = useState<SettingsSection | null>(null);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [routerSettings, setRouterSettings] = useState(defaultRouterSettings);
  const [loadingRouterSettings, setLoadingRouterSettings] = useState(true);
  const [webSearchSettings, setWebSearchSettings] = useState(defaultWebSearchSettings);
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [loadingWebSearchSettings, setLoadingWebSearchSettings] = useState(true);
  const [serverWebSearchAvailable, setServerWebSearchAvailable] = useState(false);
  const [loadingWebSearchAvailability, setLoadingWebSearchAvailability] = useState(true);
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const [attachmentPreviews, setAttachmentPreviews] = useState<Record<string, string>>({});
  const [isListening, setIsListening] = useState(false);
  const [speechInterim, setSpeechInterim] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sidebarResizeRef = useRef<{
    pointerId: number;
    startX: number;
    startWidth: number;
  } | null>(null);
  const speechRecognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const previewUrlsRef = useRef<Record<string, string>>({});
  const pendingPreviewUrlsRef = useRef<Record<string, string>>({});
  const apiSettingsLoading =
    loadingSettings ||
    loadingRouterSettings ||
    loadingWebSearchSettings ||
    loadingWebSearchAvailability;

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      try {
        const savedLanguage = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
        const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
        if (savedLanguage === "id" || savedLanguage === "en") {
          setLanguage(savedLanguage);
        }
        if (savedTheme === "light" || savedTheme === "dark") {
          setTheme(savedTheme);
        }
      } catch (preferenceError) {
        setError(
          preferenceError instanceof Error
            ? `Gagal memuat preferensi tampilan: ${preferenceError.message}`
            : "Gagal memuat preferensi tampilan.",
        );
      } finally {
        setPreferencesLoaded(true);
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!preferencesLoaded) return;
    document.documentElement.dataset.theme = theme;
    document.documentElement.lang = language;
  }, [language, preferencesLoaded, theme]);

  function updateLanguage(nextLanguage: Language) {
    setLanguage(nextLanguage);
    try {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, nextLanguage);
    } catch (preferenceError) {
      setError(
        preferenceError instanceof Error
          ? `Preferensi bahasa hanya berlaku sementara: ${preferenceError.message}`
          : "Preferensi bahasa hanya berlaku sementara.",
      );
    }
  }

  function updateTheme(nextTheme: ColorTheme) {
    setTheme(nextTheme);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    } catch (preferenceError) {
      setError(
        preferenceError instanceof Error
          ? `Preferensi tema hanya berlaku sementara: ${preferenceError.message}`
          : "Preferensi tema hanya berlaku sementara.",
      );
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function loadImagePreviews() {
      for (const conversation of conversations) {
        for (const message of conversation.messages) {
          for (const attachment of message.attachments ?? []) {
            if (
              !attachment.type.startsWith("image/") ||
              previewUrlsRef.current[attachment.id]
            ) {
              continue;
            }
            try {
              const stored = await getAttachment(attachment.id);
              if (!stored) continue;
              const previewUrl = URL.createObjectURL(stored.blob);
              if (cancelled) {
                URL.revokeObjectURL(previewUrl);
                return;
              }
              previewUrlsRef.current[attachment.id] = previewUrl;
              setAttachmentPreviews((current) => ({
                ...current,
                [attachment.id]: previewUrl,
              }));
            } catch (previewError) {
              if (!cancelled) {
                setError(
                  previewError instanceof Error
                    ? `Gagal memuat pratinjau lampiran: ${previewError.message}`
                    : "Gagal memuat pratinjau lampiran.",
                );
              }
              return;
            }
          }
        }
      }
    }

    void loadImagePreviews();
    return () => {
      cancelled = true;
    };
  }, [conversations]);

  useEffect(
    () => () => {
      const recognition = speechRecognitionRef.current;
      speechRecognitionRef.current = null;
      if (recognition) {
        recognition.onresult = null;
        recognition.onerror = null;
        recognition.onend = null;
        recognition.stop();
      }
      Object.values(previewUrlsRef.current).forEach((previewUrl) =>
        URL.revokeObjectURL(previewUrl),
      );
      Object.values(pendingPreviewUrlsRef.current).forEach((previewUrl) =>
        URL.revokeObjectURL(previewUrl),
      );
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;

    async function loadCache() {
      try {
        await Promise.resolve();
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const cached = parseCachedState(raw);
          if (cancelled) return;
          setConversations(cached.conversations);
          setActiveId(cached.activeId);
        }
      } catch (loadError) {
        if (!cancelled) {
          setCacheBlocked(true);
          setError(
            loadError instanceof Error
              ? `Tidak bisa membaca riwayat browser: ${loadError.message}`
              : "Tidak bisa membaca riwayat browser.",
          );
        }
      } finally {
        if (!cancelled) setLoadingCache(false);
      }
    }

    void loadCache();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function checkServerWebSearch() {
      try {
        const response = await fetch("/api/web-search", { cache: "no-store" });
        if (!response.ok) {
          throw new Error(`Server mengembalikan HTTP ${response.status}.`);
        }
        const payload: unknown = await response.json();
        if (!isRecord(payload) || typeof payload.configured !== "boolean") {
          throw new Error("Status konfigurasi server tidak dikenali.");
        }
        if (!cancelled) setServerWebSearchAvailable(payload.configured);
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? `Status pencarian web server tidak bisa dibaca: ${loadError.message}`
              : "Status pencarian web server tidak bisa dibaca.",
          );
        }
      } finally {
        if (!cancelled) setLoadingWebSearchAvailability(false);
      }
    }

    void checkServerWebSearch();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadRouterSettings() {
      try {
        await Promise.resolve();
        const raw = window.localStorage.getItem(ROUTER_STORAGE_KEY);
        if (raw) {
          const settings = parseRouterSettings(raw);
          if (!cancelled) setRouterSettings(settings);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? `Pengaturan Router AI tidak bisa dibaca: ${loadError.message}`
              : "Pengaturan Router AI tidak bisa dibaca.",
          );
        }
      } finally {
        if (!cancelled) setLoadingRouterSettings(false);
      }
    }

    void loadRouterSettings();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadProviderSettings() {
      try {
        await Promise.resolve();
        const raw = window.localStorage.getItem(PROVIDER_STORAGE_KEY);
        if (!raw) return;
        const settings = parseProviderSettings(raw);
        if (!cancelled) setProviderSettings(settings);
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? `Pengaturan API lokal tidak bisa dibaca: ${loadError.message}`
              : "Pengaturan API lokal tidak bisa dibaca.",
          );
        }
      } finally {
        if (!cancelled) setLoadingSettings(false);
      }
    }

    void loadProviderSettings();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadWebSearchSettings() {
      try {
        await Promise.resolve();
        const raw = window.localStorage.getItem(WEB_SEARCH_STORAGE_KEY);
        if (raw) {
          const settings = parseWebSearchSettings(raw);
          if (!cancelled) setWebSearchSettings(settings);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? `Pengaturan pencarian web tidak bisa dibaca: ${loadError.message}`
              : "Pengaturan pencarian web tidak bisa dibaca.",
          );
        }
      } finally {
        if (!cancelled) setLoadingWebSearchSettings(false);
      }
    }

    void loadWebSearchSettings();
    return () => {
      cancelled = true;
    };
  }, []);

  function persistLocalState(
    nextConversations: Conversation[],
    nextActiveId: string | null,
  ) {
    const sortedConversations = sortConversations(nextConversations);
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          version: 1,
          activeId: nextActiveId,
          conversations: sortedConversations,
        }),
      );
      setConversations(sortedConversations);
      setActiveId(nextActiveId);
      setCacheBlocked(false);
      return true;
    } catch (saveError) {
      setCacheBlocked(true);
      setError(
        saveError instanceof Error
          ? `Gagal menyimpan ke browser: ${saveError.message}`
          : "Gagal menyimpan riwayat ke browser.",
      );
      setConversations(sortedConversations);
      setActiveId(nextActiveId);
      return false;
    }
  }

  const activeConversation = conversations.find(
    (conversation) => conversation.id === activeId,
  );
  const messages = activeConversation?.messages ?? [];
  const filteredConversations = conversations.filter((conversation) =>
    conversation.title.toLowerCase().includes(search.toLowerCase()),
  );

  function toggleConversationPinned(conversation: Conversation) {
    const nextConversations = conversations.map((item) =>
      item.id === conversation.id ? { ...item, pinned: !item.pinned } : item,
    );
    persistLocalState(nextConversations, activeId);
    setOpenConversationMenuId(null);
  }

  function beginConversationRename(conversation: Conversation) {
    setConversationTitleDraft(conversation.title);
    setRenamingConversationId(conversation.id);
    setOpenConversationMenuId(null);
  }

  function cancelConversationRename() {
    setRenamingConversationId(null);
    setConversationTitleDraft("");
  }

  function saveConversationRename(
    event: FormEvent<HTMLFormElement>,
    conversationId: string,
  ) {
    event.preventDefault();
    const title = conversationTitleDraft.trim();
    if (!title) {
      setError("Nama obrolan tidak boleh kosong.");
      return;
    }

    const nextConversations = conversations.map((conversation) =>
      conversation.id === conversationId
        ? { ...conversation, title: title.slice(0, 64) }
        : conversation,
    );
    setError("");
    persistLocalState(nextConversations, activeId);
    cancelConversationRename();
  }

  async function deleteConversation(conversation: Conversation) {
    if (!window.confirm(`Hapus obrolan "${conversation.title}"?`)) return;

    const nextConversations = conversations.filter(
      (item) => item.id !== conversation.id,
    );
    const nextActiveId =
      activeId === conversation.id ? nextConversations[0]?.id ?? null : activeId;
    setError("");
    setOpenConversationMenuId(null);
    cancelConversationRename();
    if (!persistLocalState(nextConversations, nextActiveId)) return;

    const attachmentIds = [
      ...new Set(
        conversation.messages.flatMap((message) =>
          message.attachments?.map((attachment) => attachment.id) ?? [],
        ),
      ),
    ];
    try {
      await deleteAttachments(attachmentIds);
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? `Obrolan dihapus, tetapi lampirannya gagal dibersihkan: ${deleteError.message}`
          : "Obrolan dihapus, tetapi lampirannya gagal dibersihkan.",
      );
    } finally {
      attachmentIds.forEach((id) => {
        const previewUrl = previewUrlsRef.current[id];
        if (previewUrl) {
          URL.revokeObjectURL(previewUrl);
          delete previewUrlsRef.current[id];
        }
      });
      setAttachmentPreviews((current) => {
        const next = { ...current };
        attachmentIds.forEach((id) => delete next[id]);
        return next;
      });
    }
    setSidebarOpen(false);
  }

  function startNewChat() {
    if (busy) return;
    setError("");
    stopSpeechRecognition();
    discardPendingAttachments();
    if (cacheBlocked) {
      setActiveId(null);
    } else {
      persistLocalState(conversations, null);
    }
    setDraft("");
    setSidebarOpen(false);
    textareaRef.current?.focus();
  }

  function toggleSidebar() {
    if (window.matchMedia("(max-width: 820px)").matches) {
      setSidebarOpen((open) => !open);
    } else {
      setSidebarCollapsed((collapsed) => !collapsed);
    }
  }

  function startSidebarResize(event: PointerEvent<HTMLDivElement>) {
    if (
      sidebarCollapsed ||
      window.matchMedia("(max-width: 820px)").matches
    ) {
      return;
    }

    event.preventDefault();
    sidebarResizeRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startWidth: sidebarWidth,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveSidebarResize(event: PointerEvent<HTMLDivElement>) {
    const resize = sidebarResizeRef.current;
    if (!resize || resize.pointerId !== event.pointerId) return;

    const nextWidth = resize.startWidth + event.clientX - resize.startX;
    setSidebarWidth(
      Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, nextWidth)),
    );
  }

  function finishSidebarResize(event: PointerEvent<HTMLDivElement>) {
    if (sidebarResizeRef.current?.pointerId === event.pointerId) {
      sidebarResizeRef.current = null;
    }
  }

  function handleSidebarResizeKeyDown(
    event: KeyboardEvent<HTMLDivElement>,
  ) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const direction = event.key === "ArrowRight" ? 1 : -1;
    setSidebarWidth((width) =>
      Math.min(
        MAX_SIDEBAR_WIDTH,
        Math.max(MIN_SIDEBAR_WIDTH, width + direction * SIDEBAR_RESIZE_STEP),
      ),
    );
  }

  async function resetLocalCache() {
    if (!window.confirm("Hapus semua percakapan yang tersimpan di browser?")) return;
    try {
      await clearAttachments();
      window.localStorage.removeItem(STORAGE_KEY);
      Object.values(previewUrlsRef.current).forEach((previewUrl) =>
        URL.revokeObjectURL(previewUrl),
      );
      previewUrlsRef.current = {};
      setAttachmentPreviews({});
      discardPendingAttachments();
      setConversations([]);
      setActiveId(null);
      setCacheBlocked(false);
      setError("");
    } catch (clearError) {
      setError(
        clearError instanceof Error
          ? `Gagal menghapus riwayat browser: ${clearError.message}`
          : "Gagal menghapus riwayat browser.",
      );
    }
  }

  function discardPendingAttachments() {
    pendingAttachments.forEach((attachment) => {
      if (attachment.previewUrl) {
        URL.revokeObjectURL(attachment.previewUrl);
        delete pendingPreviewUrlsRef.current[attachment.meta.id];
      }
    });
    setPendingAttachments([]);
  }

  function removePendingAttachment(id: string) {
    const attachment = pendingAttachments.find((item) => item.meta.id === id);
    if (attachment?.previewUrl) {
      URL.revokeObjectURL(attachment.previewUrl);
      delete pendingPreviewUrlsRef.current[id];
    }
    setPendingAttachments((current) =>
      current.filter((item) => item.meta.id !== id),
    );
  }

  async function handleFileSelection(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.currentTarget.files ?? []);
    event.currentTarget.value = "";
    if (!files.length) return;

    const additions: PendingAttachment[] = [];
    const problems: string[] = [];
    let totalSize = pendingAttachments.reduce(
      (total, attachment) => total + attachment.meta.size,
      0,
    );

    for (const file of files) {
      if (pendingAttachments.length + additions.length >= MAX_ATTACHMENTS) {
        problems.push(`Maksimal ${MAX_ATTACHMENTS} file per pesan.`);
        break;
      }

      const kind = getAttachmentKind(file);
      if (!kind) {
        problems.push(`${file.name}: gunakan gambar JPG/PNG/WEBP/GIF atau file TXT/MD/CSV/JSON/XML.`);
        continue;
      }
      if (file.size > (kind === "image" ? MAX_IMAGE_SIZE : MAX_TEXT_SIZE)) {
        problems.push(
          `${file.name}: ukuran maksimal ${kind === "image" ? "8 MB" : "1 MB"}.`,
        );
        continue;
      }
      if (totalSize + file.size > MAX_ATTACHMENT_TOTAL_SIZE) {
        problems.push("Total ukuran lampiran maksimal 16 MB per pesan.");
        break;
      }

      try {
        let textContent: string | undefined;
        if (kind === "text") {
          const fileText = await file.text();
          textContent =
            fileText.length > MAX_TEXT_CHARS
              ? `${fileText.slice(0, MAX_TEXT_CHARS)}\n\n[Konten dipotong agar tetap ringkas.]`
              : fileText;
        }
        const id = crypto.randomUUID();
        const previewUrl =
          kind === "image" ? URL.createObjectURL(file) : undefined;
        if (previewUrl) pendingPreviewUrlsRef.current[id] = previewUrl;
        additions.push({
          meta: {
            id,
            name: file.name,
            type: getAttachmentType(file),
            size: file.size,
          },
          file,
          ...(textContent === undefined ? {} : { textContent }),
          ...(previewUrl ? { previewUrl } : {}),
        });
        totalSize += file.size;
      } catch (fileError) {
        problems.push(
          `${file.name}: ${fileError instanceof Error ? fileError.message : "gagal dibaca."}`,
        );
      }
    }

    if (additions.length) {
      setPendingAttachments((current) => [...current, ...additions]);
    }
    setError(problems.join(" "));
  }

  function saveProviderSettings(settings: ProviderSettings) {
    setProviderSettings(settings);
    setError("");

    try {
      window.localStorage.setItem(
        PROVIDER_STORAGE_KEY,
        JSON.stringify({
          version: 1,
          providerId: settings.providerId,
          baseUrl: settings.baseUrl,
          model: settings.model,
          rememberApiKey: settings.rememberApiKey,
          ...(settings.rememberApiKey ? { apiKey: settings.apiKey } : {}),
        }),
      );
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? `Pengaturan dipakai sampai halaman ditutup, tetapi gagal disimpan: ${saveError.message}`
          : "Pengaturan dipakai sampai halaman ditutup, tetapi gagal disimpan.",
      );
    }
    setSettingsSection(null);
  }

  function saveRouterSettings(settings: RouterSettings) {
    try {
      window.localStorage.setItem(
        ROUTER_STORAGE_KEY,
        JSON.stringify({
          version: 1,
          mode: settings.mode,
          profiles: settings.profiles.map((profile) => ({
            ...profile,
            ...(profile.rememberApiKey ? {} : { apiKey: undefined }),
          })),
        }),
      );
      setRouterSettings(settings);
      setError("");
      return null;
    } catch (saveError) {
      return saveError instanceof Error
        ? `Gagal menyimpan Router AI: ${saveError.message}`
        : "Gagal menyimpan Router AI.";
    }
  }

  function saveWebSearchSettings(settings: WebSearchSettings) {
    setWebSearchSettings(settings);
    setError("");

    try {
      window.localStorage.setItem(
        WEB_SEARCH_STORAGE_KEY,
        JSON.stringify({
          version: 1,
          topic: settings.topic,
          rememberApiKey: settings.rememberApiKey,
          ...(settings.rememberApiKey ? { apiKey: settings.apiKey } : {}),
        }),
      );
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? `Pengaturan berlaku sampai halaman ditutup, tetapi gagal disimpan: ${saveError.message}`
          : "Pengaturan berlaku sampai halaman ditutup, tetapi gagal disimpan.",
      );
    }
    setSettingsSection(null);
  }

  function toggleSpeechRecognition() {
    if (speechRecognitionRef.current) {
      stopSpeechRecognition();
      return;
    }

    if (!window.isSecureContext && window.location.hostname !== "localhost") {
      setError(localize(language, "Input suara memerlukan HTTPS atau localhost."));
      return;
    }

    const speechWindow = window as SpeechWindow;
    const Recognition =
      speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    if (!Recognition) {
      setError(
        localize(language, "Browser ini belum mendukung speech-to-text. Coba Chrome atau Edge."),
      );
      return;
    }

    const recognition = new Recognition();
    recognition.lang = language === "en" ? "en-US" : "id-ID";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      let finalText = "";
      let interimText = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const transcript = result[0]?.transcript ?? "";
        if (result.isFinal) finalText += transcript;
        else interimText += transcript;
      }
      if (finalText.trim()) {
        setDraft((current) =>
          `${current}${current.trim() ? " " : ""}${finalText.trim()}`,
        );
      }
      setSpeechInterim(interimText);
    };
    recognition.onerror = (event) => {
      const messages: Record<string, string> = {
        "not-allowed": "Izin mikrofon ditolak. Izinkan mikrofon di pengaturan browser.",
        "service-not-allowed": "Layanan speech-to-text tidak diizinkan browser.",
        "no-speech": "Tidak ada suara yang terdeteksi. Coba bicara lebih dekat ke mikrofon.",
        network: "Layanan speech-to-text mengalami masalah jaringan.",
      };
      setError(
        localize(
          language,
          messages[event.error ?? ""] ?? "Input suara gagal. Periksa izin mikrofon browser.",
        ),
      );
      speechRecognitionRef.current = null;
      setIsListening(false);
      setSpeechInterim("");
    };
    recognition.onend = () => {
      if (speechRecognitionRef.current === recognition) {
        speechRecognitionRef.current = null;
        setIsListening(false);
        setSpeechInterim("");
      }
    };
    speechRecognitionRef.current = recognition;
    setError("");
    setSpeechInterim("");
    setIsListening(true);
    try {
      recognition.start();
    } catch (speechError) {
      speechRecognitionRef.current = null;
      setIsListening(false);
      setError(
        speechError instanceof Error
          ? `${localize(language, "Tidak bisa memulai mikrofon")}: ${speechError.message}`
          : localize(language, "Tidak bisa memulai mikrofon."),
      );
    }
  }

  function stopSpeechRecognition() {
    const recognition = speechRecognitionRef.current;
    if (!recognition) return;
    speechRecognitionRef.current = null;
    recognition.onresult = null;
    recognition.onerror = null;
    recognition.onend = null;
    recognition.stop();
    setIsListening(false);
    setSpeechInterim("");
  }

  async function sendMessage(content = draft) {
    const text = [
      content.trim(),
      ...(content === draft && speechInterim.trim()
        ? [speechInterim.trim()]
        : []),
    ]
      .filter(Boolean)
      .join(" ");
    if (
      (!text && !pendingAttachments.length) ||
      busy ||
      loadingCache ||
      apiSettingsLoading ||
      cacheBlocked
    ) {
      return;
    }

    if (webSearchEnabled && !text.trim()) {
      setError("Tulis pertanyaan sebelum mengaktifkan pencarian web.");
      return;
    }
    if (
      webSearchEnabled &&
      !serverWebSearchAvailable &&
      !webSearchSettings.apiKey.trim()
    ) {
      setError(
        "Pencarian web belum dikonfigurasi. Atur key Tavily di server atau masukkan key pribadi melalui Pengaturan pencarian web.",
      );
      return;
    }

    const currentConversation = conversations.find(
      (conversation) => conversation.id === activeId,
    );
    const priorMessages = currentConversation?.messages ?? [];
    const targets: Array<{ name: string; settings: ProviderSettings }> = [];
    if (routerSettings.mode === "single") {
      targets.push({
        name: providerPresets[providerSettings.providerId].label,
        settings: providerSettings,
      });
    } else {
      if (routerSettings.profiles.length < 2) {
        setError("Tambahkan minimal dua profil API untuk memakai mode router.");
        setSettingsOpen(true);
        setSettingsSection("router");
        return;
      }

      if (routerSettings.mode === "round-robin") {
        const userTurn = priorMessages.filter(
          (message) => message.role === "user",
        ).length;
        const profile =
          routerSettings.profiles[userTurn % routerSettings.profiles.length];
        targets.push({ name: profile.name, settings: profile });
      } else {
        targets.push(
          ...routerSettings.profiles.map((profile) => ({
            name: profile.name,
            settings: profile,
          })),
        );
      }
    }

    if (routerSettings.mode !== "failover") {
      const selectedTarget = targets[0];
      try {
        if (!selectedTarget.settings.model.trim()) {
          throw new Error("Nama model belum diisi.");
        }
        const endpoint = new URL(
          selectedTarget.settings.baseUrl.trim().replace(/\/+$/, ""),
        );
        if (endpoint.protocol !== "http:" && endpoint.protocol !== "https:") {
          throw new Error("Gunakan Base URL http:// atau https://.");
        }
      } catch (validationError) {
        const reason =
          validationError instanceof Error
            ? validationError.message
            : "Konfigurasi API tidak valid.";
        setError(`${selectedTarget.name}: ${reason}`);
        setSettingsOpen(true);
        setSettingsSection(routerSettings.mode === "single" ? "api" : "router");
        return;
      }
    }

    stopSpeechRecognition();

    const conversationId = currentConversation?.id ?? crypto.randomUUID();
    const attachments = pendingAttachments.map(({ meta }) => meta);
    const messageText =
      text ||
      (attachments.some((attachment) => attachment.type.startsWith("image/"))
        ? "Jelaskan gambar yang saya lampirkan."
        : "Ringkas isi file yang saya lampirkan.");
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: messageText,
      ...(attachments.length ? { attachments } : {}),
    };
    const updatedConversation: Conversation = {
      id: conversationId,
      ...(currentConversation?.pinned ? { pinned: true } : {}),
      title:
        currentConversation?.title ??
        (text || attachments[0]?.name || "Lampiran").replace(/\s+/g, " ").slice(0, 64),
      updatedAt: new Date().toISOString(),
      messages: [...priorMessages, userMessage],
    };

    const updatedConversations = [
      updatedConversation,
      ...conversations.filter((conversation) => conversation.id !== conversationId),
    ];
    setBusy(true);
    setStreamingText(webSearchEnabled ? "Mencari sumber web..." : "");
    setError("");

    try {
      const savedAttachmentIds: string[] = [];
      try {
        for (const attachment of pendingAttachments) {
          await saveAttachment({
            id: attachment.meta.id,
            blob: attachment.file,
            ...(attachment.textContent === undefined
              ? {}
              : { textContent: attachment.textContent }),
          });
          savedAttachmentIds.push(attachment.meta.id);
        }
      } catch (saveError) {
        try {
          await deleteAttachments(savedAttachmentIds);
        } catch (cleanupError) {
          throw new Error(
            `Gagal menyimpan lampiran: ${saveError instanceof Error ? saveError.message : "kesalahan penyimpanan."} Pembersihan file sementara juga gagal: ${cleanupError instanceof Error ? cleanupError.message : "kesalahan penyimpanan."}`,
          );
        }
        throw saveError;
      }

      if (!persistLocalState(updatedConversations, conversationId)) {
        await deleteAttachments(savedAttachmentIds);
        return;
      }
      pendingAttachments.forEach((attachment) => {
        if (attachment.previewUrl) {
          const previewUrl = attachment.previewUrl;
          previewUrlsRef.current[attachment.meta.id] = previewUrl;
          delete pendingPreviewUrlsRef.current[attachment.meta.id];
          setAttachmentPreviews((current) => ({
            ...current,
            [attachment.meta.id]: previewUrl,
          }));
        }
      });
      setPendingAttachments([]);
      setDraft("");

      const webResults = webSearchEnabled
        ? await requestWebSearch(
            messageText,
            webSearchSettings.apiKey,
            webSearchSettings.topic,
          )
        : [];
      const apiMessages: ApiChatMessage[] = [
        {
          role: "system",
          content:
            "Nama asisten ini adalah KucAI. Jika pengguna bertanya siapa atau apa nama AI ini, jawab bahwa namamu KucAI. Jangan mengaku sebagai provider atau model yang dipilih pengguna; jika relevan, jelaskan bahwa KucAI menggunakan model dari provider pilihan pengguna.",
        },
        ...(webSearchEnabled
          ? [
              {
                role: "system" as const,
                content: formatWebSearchContext(messageText, webResults),
              },
            ]
          : []),
        ...(await Promise.all(
          [...priorMessages, userMessage].map(createApiMessage),
        )),
      ];

      const failures: string[] = [];
      let answer = "";
      for (let index = 0; index < targets.length; index += 1) {
        const target = targets[index];
        let partialAnswer = "";
        try {
          answer = await requestCompletion(
            target.settings,
            apiMessages,
            (text) => {
              partialAnswer = text;
              setStreamingText(text);
            },
          );
          break;
        } catch (requestError) {
          const reason =
            requestError instanceof Error
              ? requestError.message
              : "Request API gagal.";
          failures.push(`${target.name}: ${reason}`);
          setStreamingText("");

          if (routerSettings.mode === "failover" && partialAnswer.trim()) {
            throw new Error(
              `${target.name}: ${reason} Jawaban parsial sudah diterima, jadi profil lain tidak dicoba.`,
            );
          }

          if (
            routerSettings.mode !== "failover" ||
            index === targets.length - 1
          ) {
            throw new Error(
              failures.length > 1
                ? `Semua profil API gagal:\n${failures.join("\n")}`
                : failures[0],
            );
          }

          setError(
            `${target.name} gagal. Mencoba ${targets[index + 1].name}...`,
          );
        }
      }

      if (!answer.trim()) {
        throw new Error("Semua profil API gagal memberikan jawaban.");
      }

      setError("");
      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: `${answer}${formatWebSearchSources(webResults)}`,
      };
      const completedConversation = {
        ...updatedConversation,
        updatedAt: new Date().toISOString(),
        messages: [...updatedConversation.messages, assistantMessage],
      };
      persistLocalState(
        [
          completedConversation,
          ...updatedConversations.filter((item) => item.id !== conversationId),
        ],
        conversationId,
      );
    } catch (sendError) {
      setError(
        sendError instanceof Error
          ? sendError.message
          : "Terjadi kesalahan saat mengirim pesan.",
      );
    } finally {
      setBusy(false);
      setStreamingText("");
    }
  }

  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendMessage();
    }
  }

  const hasMessages = messages.length > 0;
  const activeProviderLabel =
    routerSettings.mode === "single"
      ? getProviderHost(providerSettings.baseUrl)
      : routerSettings.mode === "round-robin"
        ? localize(language, "Rotasi per chat")
        : localize(language, "Failover API");
  const workspaceStyle: WorkspaceStyle = {
    "--sidebar-width": `${sidebarWidth}px`,
  };

  return (
    <LanguageContext.Provider value={language}>
    <>
    <main
      className={`workspace ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}
      style={workspaceStyle}
    >
      {sidebarOpen && (
        <button
          aria-label={localize(language, "Tutup menu")}
          className="sidebar-backdrop"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <aside className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
        <div className="sidebar-top">
          <Link className="brand" href="/" aria-label={localize(language, "KucAI beranda")}>
            <span className="brand-logo-frame">
              <Image
                alt="KucAI"
                className="brand-logo"
                fill
                priority
                sizes="190px"
                src="/kucai_logo.png"
              />
            </span>
          </Link>
          <button
            className="icon-button mobile-close"
            onClick={() => setSidebarOpen(false)}
            aria-label={localize(language, "Tutup menu")}
          >
            ×
          </button>
        </div>

        <button
          className="new-chat-button"
          onClick={startNewChat}
          disabled={busy || loadingCache}
        >
          <Icon name="plus" size={17} />
          <span>{localize(language, "Percakapan baru")}</span>
          <span className="shortcut">⌘ K</span>
        </button>

        <label className="search-box">
          <Icon name="search" size={16} />
          <input
            aria-label={localize(language, "Cari percakapan")}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={localize(language, "Cari percakapan")}
          />
          <span className="search-shortcut">⌘ F</span>
        </label>

        <div className="thread-heading">{localize(language, "RIWAYAT")}</div>
        <div className="thread-list">
          {loadingCache ? (
            <p className="sidebar-empty">{localize(language, "Memuat riwayat browser...")}</p>
          ) : filteredConversations.length ? (
            filteredConversations.map((conversation) => (
              <div className="thread-row" key={conversation.id}>
                {renamingConversationId === conversation.id ? (
                  <form
                    className="thread-rename-form"
                    onSubmit={(event) =>
                      saveConversationRename(event, conversation.id)
                    }
                  >
                    <input
                      aria-label={`${localize(language, "Nama obrolan")} ${conversation.title}`}
                      autoFocus
                      maxLength={64}
                      onChange={(event) =>
                        setConversationTitleDraft(event.target.value)
                      }
                      onKeyDown={(event) => {
                        if (event.key === "Escape") {
                          event.preventDefault();
                          cancelConversationRename();
                        }
                      }}
                      required
                      value={conversationTitleDraft}
                    />
                    <button
                      aria-label={localize(language, "Simpan nama obrolan")}
                      disabled={busy || !conversationTitleDraft.trim()}
                      title={localize(language, "Simpan")}
                      type="submit"
                    >
                      ✓
                    </button>
                    <button
                      aria-label={localize(language, "Batalkan ubah nama")}
                      onClick={cancelConversationRename}
                      title={localize(language, "Batal")}
                      type="button"
                    >
                      ×
                    </button>
                  </form>
                ) : (
                  <>
                    <button
                      className={`thread-item ${activeId === conversation.id ? "thread-active" : ""}`}
                      disabled={busy}
                      onClick={() => {
                        setError("");
                        setOpenConversationMenuId(null);
                        cancelConversationRename();
                        if (cacheBlocked) {
                          setActiveId(conversation.id);
                        } else {
                          persistLocalState(conversations, conversation.id);
                        }
                        setSidebarOpen(false);
                      }}
                      type="button"
                    >
                      <Icon name="chat" size={16} />
                      <span className="thread-title">{conversation.title}</span>
                      {conversation.pinned && (
                        <span className="thread-pin-badge">PIN</span>
                      )}
                    </button>
                    <button
                      aria-controls={`thread-actions-${conversation.id}`}
                      aria-expanded={openConversationMenuId === conversation.id}
                      aria-label={`${localize(language, "Opsi obrolan")} ${conversation.title}`}
                      className="thread-menu-trigger"
                      disabled={busy}
                      onClick={() =>
                        setOpenConversationMenuId((openId) =>
                          openId === conversation.id ? null : conversation.id,
                        )
                      }
                      title={localize(language, "Opsi obrolan")}
                      type="button"
                    >
                      <Icon name="more" size={16} />
                    </button>
                    {openConversationMenuId === conversation.id && (
                      <div
                        aria-label={`${localize(language, "Aksi obrolan")} ${conversation.title}`}
                        className="thread-actions"
                        id={`thread-actions-${conversation.id}`}
                        role="group"
                      >
                        <button
                          className={`thread-action-button thread-action-pin ${conversation.pinned ? "thread-action-pinned" : ""}`}
                          disabled={busy}
                          onClick={() =>
                            toggleConversationPinned(conversation)
                          }
                          type="button"
                        >
                          <Icon name="pin" size={14} />
                          {localize(language, conversation.pinned ? "Lepas pin" : "Pin")}
                        </button>
                        <button
                          className="thread-action-button"
                          disabled={busy}
                          onClick={() =>
                            beginConversationRename(conversation)
                          }
                          type="button"
                        >
                          <Icon name="edit" size={14} />
                          {localize(language, "Ganti nama")}
                        </button>
                        <button
                          className="thread-action-button thread-action-danger"
                          disabled={busy}
                          onClick={() => void deleteConversation(conversation)}
                          type="button"
                        >
                          <Icon name="trash" size={14} />
                          {localize(language, "Hapus")}
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            ))
          ) : (
            <p className="sidebar-empty">
              {localize(language, search ? "Tidak ada percakapan yang cocok." : "Percakapan lokal akan muncul di sini.")}
            </p>
          )}
        </div>

        <div className="sidebar-bottom">
          <div className="connection-card">
            <span className="connection-indicator" />
            <div>
              <strong>{localize(language, "Tersimpan di browser")}</strong>
              <span>{localize(language, "Hanya di perangkat ini")}</span>
            </div>
          </div>
          <div className="account-row">
            <div className="avatar">L</div>
            <div className="account-copy">
              <strong>{localize(language, "Mode lokal")}</strong>
              <span>{localize(language, "Tanpa akun & database")}</span>
            </div>
            <button
              className="clear-history-button"
              onClick={resetLocalCache}
              disabled={!conversations.length || busy}
              title={localize(language, "Hapus semua percakapan")}
            >
              {localize(language, "Hapus")}
            </button>
          </div>
        </div>
      </aside>
      {!sidebarCollapsed && (
        <div
          aria-label={localize(language, "Ubah lebar sidebar")}
          aria-orientation="vertical"
          aria-valuemax={MAX_SIDEBAR_WIDTH}
          aria-valuemin={MIN_SIDEBAR_WIDTH}
          aria-valuenow={sidebarWidth}
          className="sidebar-resize-handle"
          onKeyDown={handleSidebarResizeKeyDown}
          onLostPointerCapture={finishSidebarResize}
          onPointerCancel={finishSidebarResize}
          onPointerDown={startSidebarResize}
          onPointerMove={moveSidebarResize}
          onPointerUp={finishSidebarResize}
          role="separator"
          tabIndex={0}
          title={localize(language, "Geser untuk mengubah lebar sidebar; gunakan tombol panah kiri/kanan")}
        />
      )}

      <section className="chat-panel">
        <header className="topbar">
          <button
            className="icon-button menu-button"
            onClick={toggleSidebar}
            aria-label={localize(language, "Buka atau tutup menu")}
            title={localize(language, "Buka atau tutup sidebar")}
          >
            <span aria-hidden="true" className="sidebar-toggle-desktop">
              <Icon
                name={sidebarCollapsed ? "sidebar-open" : "sidebar-close"}
                size={18}
              />
            </span>
            <span aria-hidden="true" className="sidebar-toggle-mobile">
              <Icon name="menu" />
            </span>
          </button>
          <div className="model-label">
            <span className="model-orb">✦</span>
            <span>KucAI</span>
            <span className="model-divider">/</span>
            <span className="model-provider">{activeProviderLabel}</span>
          </div>
          <div className="topbar-actions">
            <button
              aria-label={localize(language, theme === "dark" ? "Mode terang" : "Mode gelap")}
              aria-pressed={theme === "dark"}
              className="theme-toggle"
              onClick={() =>
                updateTheme(theme === "dark" ? "light" : "dark")
              }
              title={localize(language, theme === "dark" ? "Mode terang" : "Mode gelap")}
              type="button"
            >
              <Icon name={theme === "dark" ? "sun" : "moon"} size={17} />
            </button>
            <button
              aria-label={localize(language, "Buka pengaturan")}
              className="settings-button"
              disabled={
                loadingSettings ||
                loadingRouterSettings ||
                loadingWebSearchSettings
              }
              onClick={() => {
                setSettingsSection(null);
                setSettingsOpen(true);
              }}
              type="button"
            >
              <Icon name="settings" size={16} />
              <span>{localize(language, "Pengaturan")}</span>
            </button>
            <div className={`header-badge ${cacheBlocked ? "header-badge-error" : ""}`}>
              <span />
              {localize(language, cacheBlocked ? "Penyimpanan bermasalah" : "Riwayat di browser")}
            </div>
          </div>
        </header>

        <div className={`conversation-view ${hasMessages ? "conversation-active" : ""}`}>
          {hasMessages ? (
            <div className="message-list">
              {messages.map((message) => (
                <article className={`message-row message-${message.role}`} key={message.id}>
                  {message.role === "assistant" && (
                    <div className="message-avatar">✦</div>
                  )}
                  <div className="message-content">
                    {message.attachments?.length ? (
                      <div className="attachment-list">
                        {message.attachments.map((attachment) => (
                          <AttachmentCard
                            attachment={attachment}
                            key={attachment.id}
                            previewUrl={attachmentPreviews[attachment.id]}
                          />
                        ))}
                      </div>
                    ) : null}
                    {message.role === "user" ? (
                      <div className="user-bubble markdown-content">
                        <MarkdownText content={message.content} />
                      </div>
                    ) : (
                      <div className="assistant-text markdown-content">
                        <MarkdownText content={message.content} />
                      </div>
                    )}
                  </div>
                </article>
              ))}
              {busy && (
                <article className="message-row message-assistant">
                  <div className="message-avatar">✦</div>
                  <div className="message-content">
                    <div className="assistant-text markdown-content">
                      {streamingText ? (
                        <MarkdownText content={streamingText} />
                      ) : (
                        <span className="typing-indicator"><i /><i /><i /></span>
                      )}
                    </div>
                  </div>
                </article>
              )}
              <div aria-live="polite" className="sr-only">
                {busy ? localize(language, "AI sedang mengetik") : ""}
              </div>
            </div>
          ) : (
            <div className="welcome">
              <div className="welcome-logo-frame">
                <Image
                  alt="Logo KucAI"
                  className="welcome-logo"
                  fill
                  priority
                  sizes="220px"
                  src="/kucai_logo.png"
                />
              </div>
              <p className="eyebrow">{localize(language, "RUANG KERJA AI KAMU")}</p>
              <h1>{localize(language, "Ada yang bisa")}<br /><span>{localize(language, "aku bantu?")}</span></h1>
              <p className="welcome-copy">
                {localize(language, "Satu ruang untuk berpikir, membuat, dan menjelajahi berbagai kemungkinan.")}
              </p>
              <div className="suggestion-grid">
                {suggestions.map((suggestion) => (
                  <button
                    className="suggestion-card"
                    key={suggestion.title}
                    onClick={() => void sendMessage(localize(language, suggestion.prompt))}
                    disabled={busy || loadingCache || apiSettingsLoading || cacheBlocked}
                  >
                    <span className="suggestion-icon">{suggestion.icon}</span>
                    <span className="suggestion-title">{localize(language, suggestion.title)}</span>
                    <span className="suggestion-prompt">{localize(language, suggestion.prompt)}</span>
                    <span className="suggestion-arrow">↗</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="composer-wrap">
          {error && (
            <div className="error-banner" role="alert">
              <span>{localize(language, error)}</span>
              {cacheBlocked && (
                <button className="reset-cache-inline" onClick={resetLocalCache}>
                  {localize(language, "Reset cache")}
                </button>
              )}
              <button onClick={() => setError("")} aria-label={localize(language, "Tutup pesan error")}>×</button>
            </div>
          )}
          <form
            className="composer"
            onSubmit={(event: FormEvent<HTMLFormElement>) => {
              event.preventDefault();
              void sendMessage();
            }}
          >
            <input
              accept="image/jpeg,image/png,image/webp,image/gif,.txt,.md,.csv,.json,.xml"
              aria-label={localize(language, "Pilih gambar atau file teks")}
              className="sr-only"
              disabled={busy || loadingCache || apiSettingsLoading || cacheBlocked}
              multiple
              onChange={(event) => void handleFileSelection(event)}
              ref={fileInputRef}
              type="file"
            />
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={handleComposerKeyDown}
              placeholder={localize(language, "Tulis pesan untuk KucAI...")}
              rows={1}
              aria-label={localize(language, "Tulis pesan")}
              disabled={busy || loadingCache || apiSettingsLoading || cacheBlocked}
            />
            {pendingAttachments.length > 0 && (
              <div aria-label={localize(language, "Lampiran siap dikirim")} className="attachment-list pending-attachment-list">
                {pendingAttachments.map((attachment) => (
                  <AttachmentCard
                    attachment={attachment.meta}
                    key={attachment.meta.id}
                    onRemove={() => removePendingAttachment(attachment.meta.id)}
                    pending
                    previewUrl={attachment.previewUrl}
                  />
                ))}
              </div>
            )}
            {speechInterim && (
              <p aria-live="polite" className="speech-interim">
                {localize(language, "Mendengar:")} {speechInterim}
              </p>
            )}
            <div className="composer-footer">
              <div className="composer-tools">
                <button
                  aria-label={
                    webSearchEnabled
                      ? localize(language, "Matikan pencarian web")
                      : localize(language, "Aktifkan pencarian web")
                  }
                  aria-pressed={webSearchEnabled}
                  className={`composer-tool web-search-toggle ${webSearchEnabled ? "web-search-enabled" : ""}`}
                  disabled={busy || loadingCache || apiSettingsLoading || cacheBlocked}
                  onClick={() => setWebSearchEnabled((enabled) => !enabled)}
                  title={
                    webSearchEnabled
                      ? localize(language, "Pencarian web aktif untuk pesan berikutnya")
                      : localize(language, "Cari sumber terbaru di web")
                  }
                  type="button"
                >
                  <Icon name="search" size={15} />
                  <span>{localize(language, webSearchEnabled ? "Web aktif" : "Cari di web")}</span>
                </button>
                <button
                  aria-label={localize(language, "Lampirkan file atau gambar")}
                  className="composer-tool"
                  disabled={busy || loadingCache || apiSettingsLoading || cacheBlocked}
                  onClick={() => fileInputRef.current?.click()}
                  title={localize(language, "Lampirkan gambar atau file teks")}
                  type="button"
                >
                  <Icon name="plus" size={16} />
                  <span>{localize(language, "Lampirkan")}</span>
                </button>
                <span className="privacy-label"><span /> {localize(language, "Disimpan di browser")}</span>
              </div>
              <div className="composer-actions">
                <span className="enter-hint">{localize(language, "Enter untuk mengirim")}</span>
                <button
                  aria-label={localize(language, isListening ? "Berhenti merekam" : "Mulai input suara")}
                  aria-pressed={isListening}
                  className={`mic-button ${isListening ? "mic-listening" : ""}`}
                  disabled={busy || loadingCache || apiSettingsLoading || cacheBlocked}
                  onClick={toggleSpeechRecognition}
                  title={localize(language, isListening ? "Berhenti merekam" : language === "en" ? "Input suara Bahasa Inggris" : "Input suara Bahasa Indonesia")}
                  type="button"
                >
                  <Icon name="mic" size={17} />
                </button>
                <button
                  type="submit"
                  className="send-button"
                  aria-label={localize(language, "Kirim pesan")}
                  disabled={
                    (!draft.trim() && !pendingAttachments.length) ||
                    busy ||
                    loadingCache ||
                    apiSettingsLoading ||
                    cacheBlocked
                  }
                >
                  {busy ? <span className="send-spinner" /> : <Icon name="send" size={16} />}
                </button>
              </div>
            </div>
          </form>
          <p className="attachment-hint">
            {localize(language, "Gambar memerlukan model vision. File teks: TXT, MD, CSV, JSON, XML. Mikrofon mendukung browser tertentu.")}
          </p>
          <p className="disclaimer">
            {localize(language, "Riwayat tersimpan hanya di browser ini. AI dapat membuat kesalahan.")}
          </p>
        </div>
      </section>
    </main>
    {settingsOpen && !settingsSection && (
      <SettingsMenuDialog
        language={language}
        onLanguageChange={updateLanguage}
        onClose={() => setSettingsOpen(false)}
        onSelect={setSettingsSection}
      />
    )}
    {settingsOpen && settingsSection === "api" && (
      <ApiSettingsDialog
        initialSettings={providerSettings}
        onClose={() => setSettingsSection(null)}
        onSave={saveProviderSettings}
      />
    )}
    {settingsOpen && settingsSection === "router" && (
      <RouterSettingsDialog
        initialSettings={routerSettings}
        onClose={() => setSettingsSection(null)}
        onSave={saveRouterSettings}
        primarySettings={providerSettings}
      />
    )}
    {settingsOpen && settingsSection === "web-search" && (
      <WebSearchSettingsDialog
        initialSettings={webSearchSettings}
        serverKeyAvailable={serverWebSearchAvailable}
        onClose={() => setSettingsSection(null)}
        onSave={saveWebSearchSettings}
      />
    )}
    </>
    </LanguageContext.Provider>
  );
}

