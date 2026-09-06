# Sproingle: A Crunchy Rogue-lite

Turn-based dungeon crawling with a **crunchy, sproingly** aesthetic — explore generated floors, fight quirky monsters, and see how deep you can go.

Part of the [Initial Visuals](https://github.com/initialvisuals) toolkit / game experiments line.

### Status

Playable prototype (React + Vite). Monster flavor text can use Gemini when configured. Treat this as a living experiment, not a shipped release.

### What’s in the box

- Turn-based rogue-lite loop in the browser
- Procedural dungeon exploration
- Optional Gemini-powered monster descriptions
- TypeScript / React / Vite stack

### How to run

**Prerequisites:** Node.js 18+

```bash
npm install
npm run dev
```

Optional: set a Gemini API key if you want generated monster copy (see `@google/genai` usage in the app). Prefer an env var over hardcoding keys.

```bash
npm run build    # production build
npm run preview  # preview the build
```

### Related

| Repo | Role |
|------|------|
| [`sproingle_game`](https://github.com/initialvisuals/sproingle_game) | This playable source |
| [`sproinglegamesourceorig`](https://github.com/initialvisuals/sproinglegamesourceorig) | Earlier / alternate source snapshot |

### License

Initial Visuals experiment — check the repo for license details as they evolve.

---

**Initial Visuals** — tools, sims, games, and experiments.
