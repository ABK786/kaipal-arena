---
license: mit
tags:
  - ollama
  - local-ai
  - desktop
  - privacy
  - model-comparison
  - electron
---

# KAIPAL Arena

- Source and releases: https://github.com/ABK786/kaipal-arena
- Hugging Face mirror: https://huggingface.co/KOHENOOR-AI/kaipal-arena
- By Kohenoor Technologies, www.kohenoor.net, info@kohenoor.tech

A private, standalone desktop app that sends one prompt to as many as three models already installed in Ollama, shows their answers side by side, and asks a local orchestrator model to rank and select the best response.

No API keys, subscriptions, telemetry, hosted inference, or cloud services are required. Model prompts and answers stay between this app and the Ollama server on your own computer.

## What the MVP includes

- Automatic discovery of models installed in Ollama
- Selection of one to three contestant models
- Parallel model requests with individual loading, timing, and error states
- Side-by-side response comparison
- A selectable local orchestrator model (any installed model, competing or not) that scores correctness, relevance, clarity, completeness, and safety. It sees the answers as A, B and C, without model names
- A clear winning answer, ranking, model-by-model notes, and selection rationale
- Saved runtime controls for temperature, top-p, top-k, repeat penalty, output length, seed, model thinking mode, a time limit per model, and a one-model-at-a-time mode for computers with little memory
- A Stop button that cancels a running comparison
- Multi-turn chat using the previously selected winning answer as context
- A transparent on-device heuristic fallback if the judge returns invalid output
- A runner-adapter boundary for adding LM Studio, llama.cpp, or another local backend
- Loopback-only endpoint validation for privacy by default
- Ollama cloud models (names ending in `:cloud` or `-cloud`) and embedding models are never listed or accepted, so a prompt cannot leave the computer through Ollama

## Requirements

- Windows 10/11, macOS 12+, or a modern Linux distribution
- [Ollama](https://ollama.com/) installed and running
- At least one Ollama model (two or three are better for comparison)
- For development: Node.js 20 or 22 and npm

## Quick start for users

1. Install Ollama from its official website.
2. Pull a few models in a terminal. Choose sizes appropriate for your hardware:

   ```sh
   ollama pull llama3.2:3b
   ollama pull qwen2.5:3b
   ollama pull gemma2:2b
   ```

3. Download the installer for your operating system from the [GitHub Releases page](https://github.com/ABK786/kaipal-arena/releases) (or the [Hugging Face mirror](https://huggingface.co/KOHENOOR-AI/kaipal-arena)) and launch KAIPAL Arena.
4. Select up to three discovered models, choose the orchestrator, and ask a question.

Open **Settings** to tune generation. Contestant models receive the configured sampling parameters. The orchestrator keeps temperature at `0` for more stable rankings and always has at least 1024 output tokens for its verdict. Thinking mode is sent to models that support it; others answer normally. Thinking counts toward Max output tokens, so raise it (2048 or more) when thinking is on.

Choose a general-purpose model as the orchestrator. A specialist model may not judge; the round is then ranked by the on-device fallback and marked "Fallback used".

On a computer without a graphics card, small models take 30 to 60 seconds per answer. Turn on **One model at a time** if the computer cannot hold several models in memory, and raise the time limit (default 300 seconds) for larger models.

The app uses `http://127.0.0.1:11434` by default. Change it in **Settings** if your local Ollama instance uses a different loopback port.

## Run from source

```sh
git clone https://github.com/ABK786/kaipal-arena.git
cd kaipal-arena
npm install
npm run dev
```

For a production-style local run:

```sh
npm run build
npm start
```

## Test and verify

Run the complete verification suite:

```sh
npm run check
```

This performs strict TypeScript checking, unit tests, and a production renderer build. Tests do not require Ollama because the local HTTP boundary is mocked.

For a manual smoke test:

1. Start Ollama and verify `ollama list` shows at least two models.
2. Run `npm run dev`.
3. Confirm the model list loads and select two or three models.
4. Submit a prompt. Confirm every selected model gets its own result card.
5. Confirm the verdict contains a winner, scores, explanation, and selected answer.
6. Stop Ollama and refresh models to confirm the connection error is helpful.

## Build standalone installers

Build an unpacked application for the current operating system:

```sh
npm run package
```

Build a distributable installer/package:

```sh
npm run dist
```

Artifacts are written to `release/`. Installer formats are NSIS on Windows, DMG on macOS, and AppImage plus DEB on Linux. A tag such as `v0.1.0` triggers the included GitHub Actions release workflow to build all three platforms and attach them to a GitHub Release.

Code signing and notarization are intentionally not preconfigured because they require publisher-owned certificates. Until they are added, Windows shows a SmartScreen warning and macOS may refuse to open the app ("damaged" or "unidentified developer"). Sign and notarize before public production distribution.

## Hugging Face distribution

Ollama's registry hosts models only, so this desktop app is distributed through GitHub Releases and mirrored to Hugging Face. The models it compares come from the user's own Ollama.

This README includes Hugging Face repository-card metadata. The included `mirror-huggingface.yml` workflow can copy release downloads and documentation to a Hugging Face model repository after every published GitHub Release.

Configure these GitHub repository secrets:

- `HF_TOKEN`: a Hugging Face write token
- `HF_REPO_ID`: the target repository, for example `KOHENOOR-AI/kaipal-arena`

The desktop app still runs locally with Ollama; Hugging Face is only a distribution mirror and is never contacted at runtime.

## Privacy and security

- Only `localhost`, `127.0.0.1`, and IPv6 loopback runner URLs are accepted.
- Ollama cloud models are hidden and refused, even if a request names one directly.
- Only the app's own page can call the main process, the window cannot navigate away from it, and the packaged page runs under a strict Content Security Policy.
- Electron context isolation and sandboxing are enabled; the renderer has no direct Node.js access.
- No analytics, update service, remote fonts, or external inference calls are included.
- Candidate answers are marked as untrusted content in the judge prompt, labelled A, B and C without model names, and cannot close their own block, to reduce prompt-injection risk and bias.
- The selected orchestrator sees the original user request and candidate answers because it must compare them, but all evaluation occurs through local Ollama.

See [docs/ADAPTERS.md](docs/ADAPTERS.md) to add another local model runner and [SECURITY.md](SECURITY.md) to report a vulnerability.

## Known MVP limits

- Responses appear when each complete Ollama request finishes; token streaming is not yet implemented.
- Long chats can consume substantial context and memory on smaller models.
- A model-based ranking is subjective. The UI exposes scores and reasoning so the user can make the final call.
- The same local model can be both contestant and judge. For more independent judging, pick a model under "Not competing" in the orchestrator list.

## License

MIT
