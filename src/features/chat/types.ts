export type Language = "id" | "en";
export type ColorTheme = "light" | "dark";
export type MessageRole = "user" | "assistant";

export type AttachmentMeta = {
  id: string;
  name: string;
  type: string;
  size: number;
};

export type Conversation = {
  id: string;
  title: string;
  updatedAt: string;
  messages: ChatMessage[];
  pinned?: boolean;
};

export type CachedState = {
  conversations: Conversation[];
  activeId: string | null;
};

export type ChatMessage = {
  id: string;
  role: MessageRole;
  content: string;
  attachments?: AttachmentMeta[];
};

export type WebSearchTopic = "general" | "news";
export type SettingsSection = "api" | "router" | "web-search";

export type WebSearchResult = {
  title: string;
  url: string;
  content: string;
  publishedDate: string | null;
};

export type ApiChatMessage = {
  role: MessageRole | "system";
  content:
    | string
    | Array<
        | { type: "text"; text: string }
        | { type: "image_url"; image_url: { url: string } }
      >;
};
