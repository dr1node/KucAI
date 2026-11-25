# KucAI

A responsive KucAI chat workspace built with Next.js. Chat history and provider settings are stored in the current browser; no account or database is required.

## Run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), select **Pengaturan API**, and choose a provider such as OpenAI, OpenRouter, Groq, DeepSeek, Google Gemini, Mistral, or Ollama. Choosing a preset fills in its endpoint and suggested models.

- **Model** — choose a suggested model or load the provider's available models
- **API key** — required by most hosted providers; optional for local providers
- **Custom** — enter a Base URL and model ID for another OpenAI-compatible API

The app sends requests directly from the browser to the configured provider and streams the response. The provider must allow browser requests from the app's origin (CORS). For Ollama, configure its allowed origins to include the app URL. Use **Muat daftar dari API** to test the endpoint/key and load the model IDs the provider reports.

## Multi-API router

Open **Router AI**, add at least two API profiles, and choose a mode:

- **Rotasi model per percakapan** uses the profiles in order for each new user message. A new conversation starts with the first profile, then advances to the next and wraps around.
- **Fallback saat error atau tanpa jawaban** starts with the first profile for every message and tries the next one if a request fails or returns no text. If a provider has already streamed part of an answer, KucAI stops and shows an error instead of retrying, to avoid duplicate or conflicting answers.
- **Satu API** uses the provider from **Pengaturan API** and ignores router profiles.

The profile order controls both rotation and fallback order. Fallback sends the same conversation to another provider, which may use additional API quota. Router profiles and their optional remembered API keys are stored in this browser; keys are kept only in page memory unless **Simpan API key di browser ini** is selected for that profile.

## Web search

Turn on **Cari di web** in the message composer to search before asking the selected AI model. If the server has a shared key, no key entry is needed; otherwise, add a personal key in **Pengaturan pencarian web**. Choose **Web umum** or **Berita terbaru**. KucAI includes up to three search results and available page content in the model request, then appends links to the sources in the answer. Search results can be incomplete or inaccurate, so check the linked sources.

For a hosted app, set `TAVILY_API_KEY` in the server environment; users then do not need their own search key. `.env.example` lists the variable. For local development, copy it into `.env.local` and add your key there—never commit the real key. If the server key is not configured, a user can instead provide a personal key in **Pengaturan pencarian web**.

Tavily currently lists a free Researcher plan with 1,000 API credits per month and no credit card requirement; a basic search uses one credit. A server key shares that monthly allowance across all users, and plan limits can change. See [Tavily pricing](https://www.tavily.com/pricing) and the [Search API documentation](https://docs.tavily.com/documentation/api-reference/endpoint/search).

Personal search keys stay in page memory by default, or in this browser if **Simpan API key di browser ini** is selected. Search requests pass through KucAI's `/api/web-search` endpoint and are forwarded to Tavily; KucAI does not save keys on its server. The search query and retrieved page content are sent to the configured AI provider so it can write the response.

Chat messages render Markdown formatting such as **bold**, *italic*, lists, links, tables, and code blocks. Raw HTML in model responses is not rendered.

## Attachments and voice input

- Attach up to four JPG, PNG, WEBP, or GIF images, plus TXT, MD, CSV, JSON, or XML text files. Images are limited to 8 MB each; text files to 1 MB each; total attachments to 16 MB per message. Text content is capped at 30,000 characters per file.
- Attachment files are stored in IndexedDB and conversation metadata in `localStorage`. Both stay in this browser profile; deleting a conversation via browser data removes them. Use a vision-capable model for image questions. Attachments are sent directly to the configured AI provider when you send the message.
- PDF and office documents are not currently supported.
- The microphone uses the browser's Web Speech API for Indonesian (`id-ID`). It requires browser support and microphone permission, and may require HTTPS. Depending on the browser, speech recognition can be processed by its own online service; audio is not stored by this app.

## Local data and API keys

- Conversation history is kept in this browser profile and is not synced between devices. Clearing the site's browser data removes it.
- Provider URL and model are saved in browser storage when settings are saved.
- AI provider keys stay in page memory by default. The optional **Simpan API key di browser ini** setting stores a key in `localStorage` on this device; leave it unchecked on shared devices.
- AI chat requests go directly from the browser to the selected provider. The optional Tavily search key is sent through KucAI's search endpoint and forwarded to Tavily, but is not saved by the server.

## Available commands

- `npm run dev` — start the development server
- `npm run lint` — run ESLint
- `npm run build` — create a production build
- `npm run start` — serve a production build
