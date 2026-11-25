"use client";

import { useContext, useState } from "react";
import type { FormEvent } from "react";
import {
  providerAccessLinks,
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
import { Icon } from "./ChatPrimitives";
import { LanguageContext, localize } from "./i18n";
import type { Language, SettingsSection } from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object");
}
function ProviderAccessLink({ providerId }: { providerId: ProviderId }) {
  const link = providerAccessLinks[providerId];
  const language = useContext(LanguageContext);
  if (!link) return null;

  return (
    <a
      className="provider-access-link"
      href={link.href}
      rel="noreferrer noopener"
      target="_blank"
    >
      {localize(language, link.label)} ↗
    </a>
  );
}

export function SettingsMenuDialog({
  onClose,
  onSelect,
  language,
  onLanguageChange,
}: {
  onClose: () => void;
  onSelect: (section: SettingsSection) => void;
  language: Language;
  onLanguageChange: (language: Language) => void;
}) {
  return (
    <div
      className="settings-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        aria-labelledby="settings-menu-title"
        aria-modal="true"
        className="settings-dialog settings-menu-dialog"
        role="dialog"
      >
        <div className="settings-heading">
          <div className="settings-icon"><Icon name="settings" size={19} /></div>
          <div>
            <p className="eyebrow">{localize(language, "PENGATURAN APLIKASI")}</p>
            <h2 id="settings-menu-title">{localize(language, "Pengaturan")}</h2>
          </div>
          <button
            aria-label={localize(language, "Tutup pengaturan")}
            className="icon-button settings-close"
            onClick={onClose}
            type="button"
          >
            ×
          </button>
        </div>
        <p className="settings-description">
          {localize(language, "Kelola provider AI, router, dan pencarian web dari satu tempat.")}
        </p>
        <label className="settings-language-row" htmlFor="app-language">
          <span>{localize(language, "Bahasa tampilan")}</span>
          <select
            id="app-language"
            onChange={(event) =>
              onLanguageChange(event.target.value === "en" ? "en" : "id")
            }
            value={language}
          >
            <option value="id">{localize(language, "Bahasa Indonesia")}</option>
            <option value="en">{localize(language, "English")}</option>
          </select>
        </label>
        <div className="settings-menu-options">
          <button
            className="settings-menu-item"
            onClick={() => onSelect("api")}
            type="button"
          >
            <span className="settings-menu-icon"><Icon name="settings" size={18} /></span>
            <span className="settings-menu-copy">
              <strong>{localize(language, "Provider API")}</strong>
              <small>{localize(language, "Provider, Base URL, model, dan API key")}</small>
            </span>
            <span aria-hidden="true" className="settings-menu-arrow">›</span>
          </button>
          <button
            className="settings-menu-item"
            onClick={() => onSelect("router")}
            type="button"
          >
            <span className="settings-menu-icon settings-menu-router">↻</span>
            <span className="settings-menu-copy">
              <strong>{localize(language, "Router AI")}</strong>
              <small>{localize(language, "Atur beberapa API, rotasi, dan fallback")}</small>
            </span>
            <span aria-hidden="true" className="settings-menu-arrow">›</span>
          </button>
          <button
            className="settings-menu-item"
            onClick={() => onSelect("web-search")}
            type="button"
          >
            <span className="settings-menu-icon"><Icon name="search" size={18} /></span>
            <span className="settings-menu-copy">
              <strong>{localize(language, "Pencarian web")}</strong>
              <small>{localize(language, "Konfigurasi Tavily dan jenis pencarian")}</small>
            </span>
            <span aria-hidden="true" className="settings-menu-arrow">›</span>
          </button>
        </div>
      </section>
    </div>
  );
}

export function ApiSettingsDialog({
  initialSettings,
  onClose,
  onSave,
}: {
  initialSettings: ProviderSettings;
  onClose: () => void;
  onSave: (settings: ProviderSettings) => void;
}) {
  const language = useContext(LanguageContext);
  const [settings, setSettings] = useState(initialSettings);
  const [availableModels, setAvailableModels] = useState<string[]>(
    [...providerPresets[initialSettings.providerId].models],
  );
  const initialModels: string[] = [...providerPresets[initialSettings.providerId].models];
  const [customModel, setCustomModel] = useState(
    !initialModels.includes(initialSettings.model),
  );
  const [loadingModels, setLoadingModels] = useState(false);
  const [validationError, setValidationError] = useState("");
  const [modelLoadError, setModelLoadError] = useState("");

  function chooseProvider(providerId: ProviderId) {
    const preset = providerPresets[providerId];
    setSettings((current) => ({
      ...current,
      providerId,
      baseUrl: preset.baseUrl,
      model: preset.defaultModel,
      apiKey: "",
      rememberApiKey: false,
    }));
    setAvailableModels([...preset.models]);
    setCustomModel(!preset.defaultModel);
    setModelLoadError("");
    setValidationError("");
  }

  async function loadProviderModels() {
    setLoadingModels(true);
    setModelLoadError("");

    try {
      const baseUrl = settings.baseUrl.trim().replace(/\/+$/, "");
      const endpoint = new URL("models", `${baseUrl}/`);
      if (endpoint.protocol !== "http:" && endpoint.protocol !== "https:") {
        throw new Error(
          localize(language, "Base URL harus menggunakan http:// atau https://."),
        );
      }

      const headers = new Headers();
      if (settings.apiKey.trim()) {
        headers.set("Authorization", `Bearer ${settings.apiKey.trim()}`);
      }
      const response = await fetch(endpoint, {
        headers,
        cache: "no-store",
        credentials: "omit",
      });

      if (!response.ok) {
        const details = (await response.text()).slice(0, 300);
        throw new Error(
          `${localize(language, "Provider mengembalikan")} ${response.status}: ${details || localize(language, "tanpa detail")}`,
        );
      }

      const payload: unknown = await response.json();
      const rawModels =
        isRecord(payload) && Array.isArray(payload.data)
          ? payload.data
          : isRecord(payload) && Array.isArray(payload.models)
            ? payload.models
            : [];
      const models = [
        ...new Set(
          rawModels.flatMap((item) => {
            if (typeof item === "string") return [item];
            if (!isRecord(item)) return [];
            if (typeof item.id === "string") return [item.id];
            if (typeof item.name === "string") return [item.name];
            return [];
          }),
        ),
      ].slice(0, 200);

      if (!models.length) {
        throw new Error(
          localize(language, "Provider tidak mengembalikan daftar model yang dikenali."),
        );
      }

      setAvailableModels(models);
      if (models.includes(settings.model)) {
        setCustomModel(false);
      } else {
        setSettings((current) => ({ ...current, model: models[0] }));
        setCustomModel(false);
      }
    } catch (loadError) {
      const reason = loadError instanceof Error
        ? loadError.message
        : localize(language, "Request gagal.");
      setModelLoadError(
        `${reason} ${localize(language, "Periksa API key, URL, dan izin CORS.")}`,
      );
    } finally {
      setLoadingModels(false);
    }
  }

  function submitSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const baseUrl = settings.baseUrl.trim().replace(/\/+$/, "");
    const model = settings.model.trim();

    try {
      const url = new URL(baseUrl);
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        throw new Error(localize(language, "Gunakan URL http:// atau https://."));
      }
    } catch (validationError) {
      setValidationError(
        validationError instanceof Error
          ? validationError.message
          : localize(language, "Base URL tidak valid."),
      );
      return;
    }

    if (!model) {
      setValidationError(localize(language, "Nama model wajib diisi."));
      return;
    }

    onSave({ ...settings, baseUrl, model, apiKey: settings.apiKey.trim() });
  }

  return (
    <div className="settings-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section
        aria-labelledby="api-settings-title"
        aria-modal="true"
        className="settings-dialog"
        role="dialog"
      >
        <div className="settings-heading">
          <div className="settings-icon"><Icon name="settings" size={19} /></div>
          <div>
            <p className="eyebrow">{localize(language, "KONFIGURASI LOKAL")}</p>
            <h2 id="api-settings-title">{localize(language, "Pengaturan API")}</h2>
          </div>
          <button className="icon-button settings-close" onClick={onClose} aria-label={localize(language, "Tutup pengaturan")}>
            ×
          </button>
        </div>
        <p className="settings-description">
          {localize(language, "Hubungkan API yang kompatibel dengan format OpenAI. Pengaturan berlaku untuk browser ini.")}
        </p>
        <form className="settings-form" onSubmit={submitSettings}>
          <label htmlFor="api-provider">{localize(language, "Provider")}</label>
          <select
            id="api-provider"
            value={settings.providerId}
            onChange={(event) => chooseProvider(event.target.value as ProviderId)}
          >
            {Object.entries(providerPresets).map(([id, provider]) => (
              <option key={id} value={id}>{localize(language, provider.label)}</option>
            ))}
          </select>
          <p className="field-hint">
            {localize(language, "Pilih provider sebelum memasukkan API key. Mengganti provider akan mengosongkan key.")}
          </p>

          <label htmlFor="api-base-url">{localize(language, "Base URL")}</label>
          <input
            id="api-base-url"
            autoComplete="url"
            required
            value={settings.baseUrl}
            onChange={(event) => {
              setSettings((current) => ({
                ...current,
                providerId: "custom",
                baseUrl: event.target.value,
                apiKey: "",
                rememberApiKey: false,
              }));
              setAvailableModels([]);
              setCustomModel(true);
            }}
            placeholder="https://api.openai.com/v1"
          />
          <p className="field-hint">{localize(language, "Contoh lokal: http://localhost:11434/v1 — jangan tambahkan /chat/completions.")}</p>

          <div className="model-field-heading">
            <label htmlFor="api-model">{localize(language, "Model")}</label>
            <button type="button" onClick={() => void loadProviderModels()} disabled={loadingModels}>
              {loadingModels
                ? localize(language, "Memuat...")
                : localize(language, "Muat daftar dari API")}
            </button>
          </div>
          <select
            id="api-model"
            required
            value={customModel ? "__custom__" : settings.model}
            onChange={(event) => {
              if (event.target.value === "__custom__") {
                setCustomModel(true);
              } else {
                setCustomModel(false);
                setSettings((current) => ({ ...current, model: event.target.value }));
              }
            }}
          >
            {availableModels.map((model) => (
              <option key={model} value={model}>{model}</option>
            ))}
            <option value="__custom__">{localize(language, "Model lain (isi ID)")}</option>
          </select>
          {customModel && (
            <input
              aria-label={localize(language, "ID model custom")}
              required
              value={settings.model}
              onChange={(event) => setSettings((current) => ({ ...current, model: event.target.value }))}
              placeholder={localize(language, "Contoh: model-name")}
            />
          )}
          {modelLoadError && <p className="form-message form-error">{modelLoadError}</p>}

          <label htmlFor="api-key">
            {localize(language, "API key")}
            <span> {localize(language, "(opsional untuk provider lokal)")}</span>
          </label>
          <input
            id="api-key"
            type="password"
            autoComplete="new-password"
            value={settings.apiKey}
            onChange={(event) => setSettings({ ...settings, apiKey: event.target.value })}
            placeholder={localize(language, "Masukkan API key provider")}
          />
          <ProviderAccessLink providerId={settings.providerId} />

          <label className="remember-key">
            <input
              type="checkbox"
              checked={settings.rememberApiKey}
              onChange={(event) => setSettings({ ...settings, rememberApiKey: event.target.checked })}
            />
            <span>{localize(language, "Simpan API key di browser ini")}</span>
          </label>
          <p className="settings-security-note">
            {localize(language, "Tanpa opsi di atas, API key hanya disimpan sementara di memori halaman. Request dikirim langsung dari browser ke provider.")}
          </p>
          {validationError && <p className="form-message form-error">{validationError}</p>}
          <div className="settings-actions">
            <button type="button" className="settings-cancel" onClick={onClose}>{localize(language, "Batal")}</button>
            <button type="submit" className="settings-submit">{localize(language, "Simpan pengaturan")}</button>
          </div>
        </form>
      </section>
    </div>
  );
}

export function WebSearchSettingsDialog({
  initialSettings,
  serverKeyAvailable,
  onClose,
  onSave,
}: {
  initialSettings: WebSearchSettings;
  serverKeyAvailable: boolean;
  onClose: () => void;
  onSave: (settings: WebSearchSettings) => void;
}) {
  const language = useContext(LanguageContext);
  const [settings, setSettings] = useState(initialSettings);
  const [validationError, setValidationError] = useState("");

  function submitSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const apiKey = settings.apiKey.trim();
    if (!apiKey && !serverKeyAvailable) {
      setValidationError(
        localize(language, "API key Tavily wajib diisi untuk mencari di web."),
      );
      return;
    }

    onSave({ ...settings, apiKey });
  }

  return (
    <div
      className="settings-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        aria-labelledby="web-search-settings-title"
        aria-modal="true"
        className="settings-dialog"
        role="dialog"
      >
        <div className="settings-heading">
          <div className="settings-icon"><Icon name="search" size={19} /></div>
          <div>
            <p className="eyebrow">{localize(language, "PENCARIAN WEB")}</p>
            <h2 id="web-search-settings-title">{localize(language, "Pengaturan pencarian")}</h2>
          </div>
          <button
            className="icon-button settings-close"
            onClick={onClose}
            aria-label={localize(language, "Tutup pengaturan pencarian")}
            type="button"
          >
            ×
          </button>
        </div>
        <p className="settings-description">
          {serverKeyAvailable
            ? localize(language, "Pencarian web sudah disediakan server KucAI; kamu tidak perlu memasukkan API key.")
            : localize(language, "Masukkan API key Tavily pribadi atau minta pengelola aplikasi mengatur key di server.")}
        </p>
        <form className="settings-form" onSubmit={submitSettings}>
          <label htmlFor="web-search-topic">{localize(language, "Jenis pencarian")}</label>
          <select
            id="web-search-topic"
            value={settings.topic}
            onChange={(event) =>
              setSettings({
                ...settings,
                topic: event.target.value === "news" ? "news" : "general",
              })
            }
          >
            <option value="general">{localize(language, "Web umum")}</option>
            <option value="news">{localize(language, "Berita terbaru")}</option>
          </select>

          {!serverKeyAvailable && (
            <>
              <label htmlFor="web-search-api-key">{localize(language, "API key Tavily pribadi")}</label>
              <input
                autoComplete="new-password"
                id="web-search-api-key"
                onChange={(event) =>
                  setSettings({ ...settings, apiKey: event.target.value })
                }
                placeholder={localize(language, "Masukkan API key Tavily")}
                required
                type="password"
                value={settings.apiKey}
              />
              <label className="remember-key">
                <input
                  checked={settings.rememberApiKey}
                  onChange={(event) =>
                    setSettings({
                      ...settings,
                      rememberApiKey: event.target.checked,
                    })
                  }
                  type="checkbox"
                />
                <span>{localize(language, "Simpan API key di browser ini")}</span>
              </label>
              <p className="settings-security-note">
                {localize(language, "Tanpa opsi simpan, key hanya berada di memori halaman. Request diteruskan ke Tavily melalui server KucAI.")}
              </p>
            </>
          )}
          <a
            className="web-search-doc-link"
            href="https://docs.tavily.com/documentation/api-reference/endpoint/search"
            rel="noreferrer noopener"
            target="_blank"
          >
            {localize(language, "Dokumentasi API Tavily ↗")}
          </a>
          {validationError && (
            <p className="form-message form-error">{validationError}</p>
          )}
          <div className="settings-actions">
            <button
              className="settings-cancel"
              onClick={onClose}
              type="button"
            >
              {localize(language, "Batal")}
            </button>
            <button className="settings-submit" type="submit">
              {localize(language, "Simpan pengaturan")}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

export function RouterSettingsDialog({
  initialSettings,
  primarySettings,
  onClose,
  onSave,
}: {
  initialSettings: RouterSettings;
  primarySettings: ProviderSettings;
  onClose: () => void;
  onSave: (settings: RouterSettings) => string | null;
}) {
  const language = useContext(LanguageContext);
  const [settings, setSettings] = useState(initialSettings);
  const [validationError, setValidationError] = useState("");

  function updateProfile(id: string, updates: Partial<ApiProfile>) {
    setSettings((current) => ({
      ...current,
      profiles: current.profiles.map((profile) =>
        profile.id === id ? { ...profile, ...updates } : profile,
      ),
    }));
  }

  function addProfile() {
    const number = settings.profiles.length + 1;
    setSettings((current) => ({
      ...current,
      profiles: [
        ...current.profiles,
        {
          ...primarySettings,
          id: crypto.randomUUID(),
          name: `API ${number}`,
        },
      ],
    }));
    setValidationError("");
  }

  function moveProfile(index: number, direction: -1 | 1) {
    const destination = index + direction;
    if (destination < 0 || destination >= settings.profiles.length) return;
    setSettings((current) => {
      const profiles = [...current.profiles];
      [profiles[index], profiles[destination]] = [
        profiles[destination],
        profiles[index],
      ];
      return { ...current, profiles };
    });
  }

  function submitSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setValidationError("");

    if (settings.mode !== "single" && settings.profiles.length < 2) {
      setValidationError(
        localize(language, "Mode router memerlukan minimal dua profil API."),
      );
      return;
    }

    const profiles: ApiProfile[] = [];
    for (const profile of settings.profiles) {
      if (!profile.name.trim() || !profile.model.trim()) {
        setValidationError(localize(language, "Nama profil dan model wajib diisi."));
        return;
      }

      try {
        const url = new URL(profile.baseUrl.trim());
        if (url.protocol !== "http:" && url.protocol !== "https:") {
          throw new Error(localize(language, "Gunakan URL http:// atau https://."));
        }
      } catch (validationError) {
        setValidationError(
          `${profile.name || "Profil API"}: ${
            validationError instanceof Error
              ? validationError.message
              : localize(language, "Base URL tidak valid.")
          }`,
        );
        return;
      }

      profiles.push({
        ...profile,
        name: profile.name.trim(),
        baseUrl: profile.baseUrl.trim().replace(/\/+$/, ""),
        model: profile.model.trim(),
        apiKey: profile.apiKey.trim(),
      });
    }

    const error = onSave({ ...settings, profiles });
    if (error) {
      setValidationError(error);
      return;
    }
    onClose();
  }

  return (
    <div
      className="settings-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        aria-labelledby="router-settings-title"
        aria-modal="true"
        className="settings-dialog router-settings-dialog"
        role="dialog"
      >
        <div className="settings-heading">
          <div className="settings-icon"><span aria-hidden="true">↻</span></div>
          <div>
            <p className="eyebrow">{localize(language, "PILIHAN ROUTER")}</p>
            <h2 id="router-settings-title">{localize(language, "Multi API")}</h2>
          </div>
          <button
            aria-label={localize(language, "Tutup Router AI")}
            className="icon-button settings-close"
            onClick={onClose}
            type="button"
          >
            ×
          </button>
        </div>
        <p className="settings-description">
          {localize(language, "Urutan profil menentukan giliran model dan urutan fallback. API key yang tidak dipilih untuk disimpan hanya berada di memori halaman.")}
        </p>
        <form className="router-settings-form" onSubmit={submitSettings}>
          <label htmlFor="router-mode">{localize(language, "Mode penggunaan API")}</label>
          <select
            id="router-mode"
            onChange={(event) =>
              setSettings((current) => ({
                ...current,
                mode: event.target.value as RouterMode,
              }))
            }
            value={settings.mode}
          >
            <option value="single">{localize(language, "Satu API — pakai Pengaturan API")}</option>
            <option value="round-robin">{localize(language, "Rotasi model per percakapan")}</option>
            <option value="failover">{localize(language, "Fallback saat error atau tanpa jawaban")}</option>
          </select>
          <p className="field-hint">
            {settings.mode === "round-robin"
              ? localize(language, "Setiap pesan baru bergiliran sesuai urutan profil. Percakapan baru mulai dari profil pertama.")
              : settings.mode === "failover"
                ? localize(language, "Setiap pesan mencoba profil dari urutan pertama. Jika gagal sebelum menghasilkan teks, lanjut ke profil berikutnya.")
                : localize(language, "Mode ini menggunakan konfigurasi di Pengaturan API dan tidak memakai daftar profil router.")}
          </p>
          {settings.mode === "failover" && (
            <p className="field-hint">
              {localize(language, "Jika stream sudah mengirim sebagian jawaban lalu terputus, router tidak mengulang ke API lain agar jawaban tidak tercampur.")}
            </p>
          )}

          <div className="router-profile-heading">
            <div>
              <h3>{localize(language, "Daftar API")}</h3>
              <p>{localize(language, "Urutan dari atas ke bawah dipakai oleh router.")}</p>
            </div>
            <button className="add-profile-button" onClick={addProfile} type="button">
              {localize(language, "+ Tambah API")}
            </button>
          </div>

          {settings.profiles.length === 0 && (
            <p className="router-empty">
              {localize(language, "Belum ada profil. Tambahkan profil untuk memakai rotasi atau fallback.")}
            </p>
          )}

          <div className="router-profiles">
            {settings.profiles.map((profile, index) => {
              const modelOptions: string[] = [
                ...providerPresets[profile.providerId].models,
              ];
              const customModel = !modelOptions.includes(profile.model);

              return (
                <fieldset className="router-profile-card" key={profile.id}>
                  <legend>{localize(language, "Profil")} {index + 1}</legend>
                  <div className="router-profile-controls">
                    <button
                      aria-label={localize(language, "Pindahkan profil ke atas")}
                      disabled={index === 0}
                      onClick={() => moveProfile(index, -1)}
                      type="button"
                    >
                      ↑
                    </button>
                    <button
                      aria-label={localize(language, "Pindahkan profil ke bawah")}
                      disabled={index === settings.profiles.length - 1}
                      onClick={() => moveProfile(index, 1)}
                      type="button"
                    >
                      ↓
                    </button>
                    <button
                      aria-label={localize(language, "Hapus profil")}
                      className="remove-profile-button"
                      onClick={() =>
                        setSettings((current) => ({
                          ...current,
                          profiles: current.profiles.filter(
                            (item) => item.id !== profile.id,
                          ),
                        }))
                      }
                      type="button"
                    >
                      {localize(language, "Hapus")}
                    </button>
                  </div>
                  <div className="router-profile-grid">
                    <label>
                      {localize(language, "Nama profil")}
                      <input
                        onChange={(event) =>
                          updateProfile(profile.id, { name: event.target.value })
                        }
                        required
                        value={profile.name}
                      />
                    </label>
                    <label>
                      {localize(language, "Provider")}
                      <select
                        onChange={(event) => {
                          const providerId = event.target.value as ProviderId;
                          const preset = providerPresets[providerId];
                          updateProfile(profile.id, {
                            providerId,
                            baseUrl: preset.baseUrl,
                            model: preset.defaultModel,
                            apiKey: "",
                            rememberApiKey: false,
                          });
                        }}
                        value={profile.providerId}
                      >
                        {Object.entries(providerPresets).map(([id, provider]) => (
                          <option key={id} value={id}>{localize(language, provider.label)}</option>
                        ))}
                      </select>
                    </label>
                    <label className="router-profile-wide">
                      {localize(language, "Base URL")}
                      <input
                        autoComplete="url"
                        onChange={(event) =>
                          updateProfile(profile.id, {
                            baseUrl: event.target.value,
                            apiKey: "",
                            rememberApiKey: false,
                          })
                        }
                        required
                        value={profile.baseUrl}
                      />
                    </label>
                    <label>
                      {localize(language, "Model")}
                      <select
                        onChange={(event) =>
                          updateProfile(profile.id, {
                            model:
                              event.target.value === "__custom__"
                                ? ""
                                : event.target.value,
                          })
                        }
                        value={customModel ? "__custom__" : profile.model}
                      >
                        {modelOptions.map((model) => (
                          <option key={model} value={model}>{model}</option>
                        ))}
                        <option value="__custom__">{localize(language, "Model custom...")}</option>
                      </select>
                    </label>
                    {customModel && (
                      <label>
                        {localize(language, "ID model")}
                        <input
                          onChange={(event) =>
                            updateProfile(profile.id, { model: event.target.value })
                          }
                          placeholder={localize(language, "Masukkan ID model")}
                          required
                          value={profile.model}
                        />
                      </label>
                    )}
                    <label className="router-profile-wide">
                      {localize(language, "API key")}
                      <input
                        autoComplete="new-password"
                        onChange={(event) =>
                          updateProfile(profile.id, { apiKey: event.target.value })
                        }
                        placeholder={localize(language, "Masukkan API key provider")}
                        type="password"
                        value={profile.apiKey}
                      />
                    </label>
                    <ProviderAccessLink providerId={profile.providerId} />
                    <label className="remember-key router-remember-key">
                      <input
                        checked={profile.rememberApiKey}
                        onChange={(event) =>
                          updateProfile(profile.id, {
                            rememberApiKey: event.target.checked,
                          })
                        }
                        type="checkbox"
                      />
                      <span>{localize(language, "Simpan key di browser ini")}</span>
                    </label>
                  </div>
                </fieldset>
              );
            })}
          </div>

          {validationError && (
            <p className="form-message form-error" role="alert">
              {validationError}
            </p>
          )}
          <div className="settings-actions">
            <button className="settings-cancel" onClick={onClose} type="button">
              {localize(language, "Batal")}
            </button>
            <button className="settings-submit" type="submit">
              {localize(language, "Simpan router")}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

