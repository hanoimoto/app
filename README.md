# Hanoi Motorbike Rental Chatbot – MotoAI v39

This repository contains a small, local-first chatbot script used for a real **Hanoi motorbike rental & sale** business.  
The file:

- `motoai_v39_modelfirst_nomarkdown_nolink.js`

is a standalone chatbot engine that runs directly in the browser without any external API keys. It is designed for small business websites, especially **motorbike rental & used bike sale** services in Hanoi.

---

## What this chatbot does

MotoAI v39 is currently deployed on:

- Main demo / app: **https://hanoimoto.github.io/app/**
- Official rental website: **https://rentbikehanoi.com**
- Facebook page (service page with reviews):  
  **https://m.facebook.com/cheapmotorbikerentalhanoi/**

The chatbot helps visitors:

- Ask about **Hanoi motorbike rental** (daily, weekly, monthly).
- Ask about **used motorbikes for sale** (e.g. Honda Vision, Honda Airblade).
- Get quick answers about:
  - documents & paperwork (passport, ID, Blue Card / “cavet”),
  - deposit & damage policies,
  - opening hours & location,
  - delivery / pickup options in Hanoi.

All replies are plain text, **no markdown and no clickable links inside the reply text**, so it’s safe to embed in simple static sites.

---

## Key features

- 🧠 **Local-first logic**  
  No external AI API is called. All logic is implemented in vanilla JavaScript with:
  - simple semantic matching,
  - FAQ-style answers,
  - price estimation patterns for different bike types.

- 🌍 **Bilingual support (EN + VI)**  
  The chatbot auto-detects whether the user is typing in **English** or **Vietnamese** and replies accordingly.

- 🛵 **Motorbike rental & sale focused**  
  Optimised for:
  - scooters (Honda Vision, Airblade, Lead…),
  - semi-automatic bikes (Wave, Sirius, Blade…),
  - basic price hints for day / week / month rental.

- 💬 **Modern UI – left side bubble**  
  - Chat bubble + chat card pinned on the **left side** (desktop & mobile).
  - Smooth open/close animation.
  - Typing indicator (3 dots).
  - Quick suggestion tags for common questions (prices, documents, deposit, delivery).

- 🧾 **No markdown & no links in replies**  
  The script automatically removes URLs and markdown syntax from generated answers so that replies stay clean and simple.

- 📚 **Auto-learn from page text (lightweight)**  
  The script can read the current page text (`document.body.innerText`) to extract a few relevant sentences for more contextual answers (e.g. from a pricing or FAQ section on the same page).

---

## How to use in your own site

1. **Copy the script file**  
   Put `motoai_v39_modelfirst_nomarkdown_nolink.js` in your site (for example on GitHub Pages or any static hosting).

2. **Include it in your HTML** (near the end of `<body>`):

   ```html
   <script src="https://hanoimoto.github.io/app/motoai_v39_modelfirst_nomarkdown_nolink.js" defer></script>

	4.	The chatbot bubble will appear automatically in the bottom-left corner on your page.

⸻

Example: Real business using this repo

This chatbot is used in a real local service called Hanoi Motorbike Rental & Sale, providing:
	•	Used Honda scooters (e.g. Vision, Airblade) with full Blue Card / paperwork.
	•	Long-term and monthly rentals for expats and teachers.
	•	Support in English and Vietnamese.

You can see it in action here:
	•	App/demo page: https://hanoimoto.github.io/app/
	•	Main site: https://rentbikehanoi.com
	•	Facebook: https://m.facebook.com/cheapmotorbikerentalhanoi/

⸻

Contact – Hanoi Motorbike Rental & Sale

If you want to:
	•	rent a scooter in Hanoi,
	•	buy a used motorbike with full paperwork,
	•	or ask about integrating this chatbot into your own website,

you can contact the shop directly:
	•	📍 Address:
112 Nguyen Van Cu, Long Bien, Hanoi (Near Old Quarter)
	•	📞 Phone / Zalo / WhatsApp:
+84 812 050 090
	•	🕘 Opening hours:
09:00 – 21:00 (Open daily)
	•	✉️ Email:
nguyentuantu1102@gmail.com

⸻

Notes
	•	This project is intentionally lightweight and works well on static HTML sites (GitHub Pages, simple hosting, etc.).
	•	No build step, no dependencies, just a single JS file.
	•	Good for local services that want a “smart” FAQ & price helper without paying for external AI APIs.

Feel free to fork this repo, adapt the script for your own city or niche (e.g. car rental, tours, small hotel), and improve the logic to better match your content.
