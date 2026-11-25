"use client";

import Image from "next/image";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useContext } from "react";
import type { AttachmentMeta } from "./types";
import { LanguageContext, localize } from "./i18n";
export function Icon({
  name,
  size = 18,
}: {
  name:
    | "plus"
    | "search"
    | "chat"
    | "more"
    | "pin"
    | "edit"
    | "trash"
    | "send"
    | "menu"
    | "settings"
    | "sun"
    | "moon"
    | "mic"
    | "sidebar-close"
    | "sidebar-open";
  size?: number;
}) {
  const paths = {
    plus: <path d="M12 5v14M5 12h14" />,
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
    chat: <><path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5H6l-3 2v-5.5A7.5 7.5 0 1 1 20 11.5Z" /><path d="M8 11h.01M12 11h.01M16 11h.01" /></>,
    more: <path d="M5 12h.01M12 12h.01M19 12h.01" strokeWidth={3} />,
    pin: <path d="m16 3 5 5-4 1-4 4 1 4-2 2-2-5-5-2 2-2 4 1 4-4z" />,
    edit: <path d="m16 4 4 4M4 20l4-.8L19 8a2.1 2.1 0 0 0-3-3L5 16l-1 4Z" />,
    trash: <><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" /><path d="M10 11v5M14 11v5" /></>,
    send: <><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></>,
    menu: <><path d="M4 6h16M4 12h16M4 18h16" /></>,
    "sidebar-close": <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M9 4v16M16 9l-3 3 3 3" /></>,
    "sidebar-open": <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M9 4v16M13 9l3 3-3 3" /></>,
    settings: <><path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z" /><path d="m19.4 15 .1.1a1.8 1.8 0 1 1-2.5 2.5l-.1-.1a1.8 1.8 0 0 0-3 .9v.2a1.8 1.8 0 1 1-3.6 0v-.2a1.8 1.8 0 0 0-3-.9l-.1.1a1.8 1.8 0 1 1-2.5-2.5l.1-.1a1.8 1.8 0 0 0-.9-3h-.2a1.8 1.8 0 1 1 0-3.6h.2a1.8 1.8 0 0 0 .9-3l-.1-.1a1.8 1.8 0 1 1 2.5-2.5l.1.1a1.8 1.8 0 0 0 3-.9v-.2a1.8 1.8 0 1 1 3.6 0v.2a1.8 1.8 0 0 0 3 .9l.1-.1a1.8 1.8 0 1 1 2.5 2.5l-.1.1a1.8 1.8 0 0 0 .9 3h.2a1.8 1.8 0 1 1 0 3.6h-.2a1.8 1.8 0 0 0-.9 3Z" /></>,
    sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" /></>,
    moon: <path d="M20.9 13A9 9 0 0 1 11 3.1 9 9 0 1 0 20.9 13Z" />,
    mic: <><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M9 22h6" /></>,
  };

  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  );
}

export function MarkdownText({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        a: ({ href, children }) => (
          <a href={href} rel="noreferrer noopener" target="_blank">
            {children}
          </a>
        ),
        img: ({ alt }) => (
          <span className="markdown-image-label">
            {alt ? `Gambar: ${alt}` : "Gambar"}
          </span>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

export function AttachmentCard({
  attachment,
  previewUrl,
  pending = false,
  onRemove,
}: {
  attachment: AttachmentMeta;
  previewUrl?: string;
  pending?: boolean;
  onRemove?: () => void;
}) {
  const language = useContext(LanguageContext);
  const isImage = attachment.type.startsWith("image/");
  const extension = attachment.name.split(".").pop()?.slice(0, 5).toUpperCase() || "FILE";
  const size =
    attachment.size < 1024 * 1024
      ? `${Math.max(1, Math.round(attachment.size / 1024))} KB`
      : `${(attachment.size / (1024 * 1024)).toFixed(1)} MB`;

  return (
    <div className={`attachment-card ${pending ? "attachment-pending" : ""}`}>
      {isImage && previewUrl ? (
        <div className="attachment-image-wrap">
          <Image
            alt={attachment.name}
            className="attachment-thumbnail"
            fill
            sizes="(max-width: 600px) 148px, 168px"
            src={previewUrl}
            unoptimized
          />
        </div>
      ) : (
        <span aria-hidden="true" className="attachment-file-icon">{extension}</span>
      )}
      <span className="attachment-copy">
        <strong title={attachment.name}>{attachment.name}</strong>
        <small>{size}</small>
      </span>
      {onRemove && (
        <button
          aria-label={`${localize(language, "Hapus lampiran")} ${attachment.name}`}
          className="attachment-remove"
          onClick={onRemove}
          type="button"
        >
          ×
        </button>
      )}
    </div>
  );
}

