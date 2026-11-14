> ⚠️ **Update Notice:** This update has desynced workflows, please persist logging out of the app, putting your data to risk, also the gemini and ui has got an upgrade, check it out!
> No data is collected! Enojoy

# 🌌 Aether

**A fluid, flexible, and capable knowledge studio — uniting note-taking with artificial intelligence, topographic study tracking, and customizable liquid glass aesthetics.**

[![License: All Rights Reserved](https://img.shields.io/badge/License-All_Rights_Reserved-dc2626?style=for-the-badge&logo=lock&logoColor=white)](#-license--legal-notice)
[![Use Case: Educational & Local Only](https://img.shields.io/badge/Purpose-Educational_%26_Local_Only-f59e0b?style=for-the-badge&logo=bookstack&logoColor=white)](#-terms-of-use)
[![Redistribution: Prohibited](https://img.shields.io/badge/Redistribution_%26_Hosting-Strictly_Prohibited-991b1b?style=for-the-badge&logo=probot&logoColor=white)](#-terms-of-use)

[![React 19](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-7.x-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-8.x-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Google Gemini API](https://img.shields.io/badge/Gemini_API-@google%2Fgenai-4285F4?style=flat-square&logo=googlegemini&logoColor=white)](https://ai.google.dev/)
[![Firebase](https://img.shields.io/badge/Firebase-Auth_%26_Firestore-FFCA28?style=flat-square&logo=firebase&logoColor=black)](https://firebase.google.com/)

---

## 📖 Overview

**Aether** is an interactive, AI-assisted academic workspace crafted to unify multi-source research synthesis, structured block-based note-taking, study analytics, and deep reasoning inside a responsive liquid-glass interface.

> ⚠️ **Important Notice:** This repository is published strictly for **educational inspection and local personal execution**. Please read the [Terms of Use](#-terms-of-use) and [License & Legal Notice](#-license--legal-notice) carefully before cloning or running this project.

---

## ✨ Key Modules & Features

* 🔺 **Interactive WebGL Lander (`PolygonCanvas`):** Real-time GPU-accelerated reactive polygon mesh simulation with customizable color palettes and cursor physics.
* 🧭 **Topographic Study Dashboard:** Unified study tracking heatmap, daily **Tasks** & **Weekly Timetable** side-by-side workspace, exam schedule photo decoder, planners, and syllabus progress cards.
* 📚 **Grounded NotebookLM Workspace:** Multi-source grounding for PDFs, images, text files, and generated study guides, briefings, FAQs, and audio overview scripts.
* 📓 **OneNote Rich Block Canvas:** Structured notebooks, color-coded sections, nested pages, KaTeX mathematical equation rendering, and VS Code-themed multi-language syntax highlighting.
* 🤖 **Standalone Gemini Workspace:** Extended reasoning mode (`ThinkingLevel.HIGH`), file/image attachments, streaming SSE responses, and bring-your-own Gemini API key support.
* 🎨 **Liquid Glass Customization Engine:** Light/Dark themes, custom primary/accent palette morphing, dynamic pointer glow, smooth momentum scrolling, and custom SVG/physics cursors.
* ☁️ **Flexible Persistence:** Works locally in Guest Mode (`localStorage`) or syncs across devices with Google Sign-In via Firebase Authentication and Cloud Firestore.

---

## 🛠️ Tech Stack

* 🖥️ **Frontend:** React 19, TypeScript, Tailwind CSS v4, Lucide Icons, KaTeX, Marked, Lenis, Motion
* ⚡ **Backend / Proxy:** Express (`server.ts`) + Vite middleware & `@google/genai` SDK
* 🗄️ **Cloud Sync (Optional):** Firebase Authentication (Google Sign-In) & Cloud Firestore

---

## 💻 Running Locally (Educational Use)

To run Aether strictly on your local machine for personal educational study:

1. **Install dependencies**
   ```bash
   npm install
   ```
2. **Configure local environment variables**
   Copy `.env.example` to `.env.local` and set your own personal Gemini API key if desired (or enter your personal key inside the app's login/Settings flow):
   ```env
   GEMINI_API_KEY="YOUR_PERSONAL_GEMINI_API_KEY"
   ```
3. **Start the local development server**
   ```bash
   npm run dev
   ```
4. Open `http://localhost:3000` in your browser.

---

## 🚫 Terms of Use

This codebase is shared solely so learners and reviewers can inspect the implementation and run it **locally for educational purposes**.

* ✅ **Permitted:** Viewing the code and running the project locally on your own machine for personal, non-commercial educational study.
* ❌ **Strictly Prohibited Without Written Permission:**
  * Modifying, editing, or creating derivative versions of this codebase.
  * Re-uploading, mirroring, publishing, or redistributing the source code (in whole or in part) to any public or private repository, archive, or platform.
  * Hosting, deploying, or serving a live instance of this application anywhere online (publicly or commercially).

---

## 📜 License & Legal Notice

**Proprietary Educational Source — All Rights Reserved © `2pro4youx`**

*No open-source license (including MIT) applies to this repository.*

This software and its accompanying source files are made viewable strictly for **educational purposes** and **local personal execution**. **No license or permission is granted** to edit, copy, modify, redistribute, re-upload, sublicense, or host this software or any derivative work in any environment without explicit prior written authorization from the author.

⚖️ **Legal Warning:** Unauthorized editing, re-uploading, redistribution, or hosting of this project without the author's explicit permission constitutes copyright infringement / unauthorized use and **may subject the infringing party to legal action and liability**. Such actions are strictly prohibited and strongly unadvised.
