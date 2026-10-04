# LLM Explained

**How a language model writes, one token at a time — inside Qwen3.8-27B.**

An animated, interactive course that follows a single token through a real, modern hybrid language model: tokenization, embeddings, 64 layers of Gated DeltaNet and gated attention, the MLP, logits and sampling, prefill and decode, the KV cache, multi-token prediction, vision, and why hardware matters. Every number about the model comes from its published configuration and weights; example values inside vectors are illustrative.

- **Three ways to watch:** a short version (~3 min, for anyone), the main story (~17 min, technical) and the full course (~47 min, every scene).
- **18 chapters** with animated scenes, narration, optional "Deeper" maths boxes with plain-language readings, and interactive tools (including the real Qwen3.8 tokenizer running in your browser).

Open the site: https://kjellix.github.io/llm-explained/ — or clone and serve the folder with any static web server (`python3 -m http.server`). Everything is static HTML/JS/SVG; no build step.

## Licences

- Course content (text, animations, narration audio): [CC BY 4.0](LICENSE-CONTENT.md)
- Code: [MIT](LICENSE)
- Fonts: Inter and JetBrains Mono, SIL Open Font License (see `assets/fonts/`)
- `assets/data/qwen38-tokenizer.json` is derived from the Qwen3.8 tokenizer (Apache-2.0)
- Draft narration voice: Kokoro-82M (Apache-2.0), synthetic speech

Qwen is a trademark of Alibaba Cloud. This course is independent and not affiliated with or endorsed by the Qwen team or any other model maker mentioned.
