# Michael Graham — Squared Away

> **"Equip Your Team to Move from Successful to Exceptional."**  
> Premium keynote speaking, executive leadership workshops, and author platform for Colonel (Ret.) Michael A. Graham.

---

## Overview

A high-converting, single-page lead-generation landing page for corporate event planners, leadership summits, and executive retreats looking to bring in Michael Graham.

The design is disciplined, architectural, and confident, modeled after executive Framer editorial standards (such as Nord Consulting) and infused with signature motion design patterns adapted from [Magic UI](https://github.com/magicuidesign/magicui.git) (`blurInUp` Word Pull Up, `blur-fade` scroll reveals, `animated-shiny-text`, and `number-ticker` counters).

---

## Brand Architecture & Tokens

* **Primary Background:** Deep Navy (`#1D3042`)
* **Alternate Clean Background:** Warm White (`#FFFCF5`)
* **Accent & CTAs:** Muted Gold (`#D5AE4F`)
* **Supporting Accents:** Olive Green (`#74834F`) and Khaki (`#D8C49B`)
* **Typography:**
  * **Headlines:** Anton (Oversized, condensed, bold)
  * **Body & Supporting:** Helvetica / System Sans-Serif (Clean, readable, disciplined)
  * **Quotes & Reflections:** EB Garamond (Editorial serif)

---

## Page Architecture (7 Sections)

1. **01 — The Opening (Hero):** 50/50 split with Michael Graham portrait, military command credential counters, and primary availability CTA.
2. **02 — Experience (Social Proof):** Speaking stage reel, executive podcast appearances, and key media logos.
3. **03 — Impact (The Framework):** Bento grid architecture outlining the core discipline: *Decide, Be, Know, Do*.
4. **04 — Ways to Bring Michael In (Services & Topics):** Keynotes, Executive Workshops, and Interviews, featuring 4 signature leadership topics.
5. **05 — Meet Michael (About):** Concise, authoritative biography covering 27+ years of service, Judge Advocate General credentials, and leadership philosophy.
6. **06 — Books & Ideas:** High-resolution book covers for *United Traits of America* and *Squared Away: A Soldier’s Guide to an Exceptional Life*.
7. **07 — Start a Conversation (Lead Gen):** Corporate inquiry form protected by server-side validation, HMAC time-gated tokens, rate limiting, and honeypot bot defense.

---

## Tech Stack & Architecture

* **Frontend:** Semantic HTML5, modern CSS3 (Custom properties, grid, flexbox, clamp typography), vanilla ES6+ (IntersectionObserver, NumberTicker, word-splitting engine).
* **Backend / API:**
  * Node.js native HTTP server (`server.js`) for local development and self-hosted environments.
  * Serverless Edge/Node Functions (`/api/form-token.js`, `/api/inquire.js`) optimized for **Vercel** deployment.
* **Security & Spam Protection:**
  * HMAC-SHA256 time-gated form token validation (prevents automated instant-submission bots).
  * Honeypot field traps (`company_website`).
  * IP-based sliding-window rate limiting.
  * Strict input sanitization and length bounds.

---

## Local Development

```bash
# Clone the repository
git clone https://github.com/teamvideobypro/squared-away.git
cd squared-away

# Run local development server
npm start
# Server listens at http://127.0.0.1:3000/
```

---

## Deployment (Vercel)

Configured for zero-config Vercel deployment via `vercel.json` with static asset caching and serverless API endpoints.
