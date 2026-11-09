# AetherLearn: Dual-Engine Learning Suite (NotebookLM & OneNote) with Liquid Glass & Interactive Polygon Physics

A production-grade, Apple-inspired learning operating system featuring an interactive red-and-gold polygon substance, Google NotebookLM multi-source synthesis, a full-screen OneNote multi-tab rich-block notebook with Hyprland workspace transitions, a carved topographic dashboard with a GitHub-style study heatmap, and server-side Gemini intelligence with High Thinking mode.

***

### User Review & Critical Decisions

> [!IMPORTANT]
> The following choices were clarified and agreed upon during Turn 1:
> - **Dual Learning Engine**: Full replication of both **Google NotebookLM** (source grounding, source synthesis, AI citation chat) and **Microsoft OneNote** (hierarchical notebooks, multi-tab sections, pages, rich draggable block editing).
> - **Hyprland Workspace Navigation**: When opening the OneNote workspace from the Notebook, the view smoothly slides in horizontally from the right, providing a faint sliding back-arrow on the left edge that guides the user back to the primary workspace.
> - **Polygon Substance**: High-performance interactive HTML5 Canvas / WebGL polygon mesh with red & gold vertex shading and dynamic mouse-proximity wave displacement.
> - **Liquid Glass Architecture**: Cursor-reactive specular lighting, Apple-grade frosted glass (`backdrop-blur-md` with specular highlight tracks), and draggable modular tiles across Dashboard and Library.
> - **AI Integration**: Express server-side proxy leveraging `@google/genai` with model selection (including `gemini-3.8-flash` and `gemini-4-argon` with `ThinkingLevel.HIGH` for deep reasoning).

***

## 1. Overview & Core Concept

**AetherLearn** is designed for high-performing students and researchers who need both grounded multi-source synthesis (NotebookLM) and deep, hierarchical freeform documentation (OneNote), packaged in an aesthetic that blends Apple's liquid glass with a bespoke red-and-gold polygon simulation.

### Key Value Pillars
1. **Interactive Lander Substance**: An optimized interactive polygon mesh in shades of crimson and gold that ripples and flows with mouse hover physics.
2. **Topographic Dashboard**: Elegant elevation-carved backdrop hosting a draggable task checklist, planner widget, global search, and a 365-day GitHub-style study hour activity heatmap.
3. **Google NotebookLM Workspace**: Multi-source grounding (documents, research papers, notes, URLs) that powers side-by-side synthesis, source guides, and AI chat.
4. **OneNote Sliding Workspace**: Multi-tab notebook interface (Notebooks > Sections > Pages) with rich block editing, accessible via a Hyprland-inspired horizontal sliding transition with a faint return arrow.
5. **Dominant Golden Header**: Top-center aligned navigation with a rounded gold-and-black '+' action hub at the center.
6. **Liquid Glass & Floating Gemini Assistant**: Cursor-spotlighted glass cards and a persistent right-aligned floating assistant capable of switching models and enabling deep reasoning.
7. **Comprehensive Settings & Analytics**: 10 curated color themes, dark/light modes, model switcher, student interaction audits, and subject-level study time analytics.

***

## 2. User Experience & Visual Design

### Design Tokens & Visual Hierarchy
- **Canvas Neutrals**: Deep obsidian slate (`#0B0F17`) in dark mode and crisp mist (`#F8FAFC`) in light mode, textured with delicate topographic vector elevation contours.
- **Brand Accents**: Imperial Crimson (`#DC2626` / `#991B1B`) and Burnished Gold (`#F59E0B` / `#D97706` / `#FEF08A`).
- **Surface Material**: Apple-inspired Liquid Glass (`rgba(255, 255, 255, 0.05)` dark / `rgba(255, 255, 255, 0.65)` light), dual-tone hairline borders (`border-white/10` and `border-amber-500/20`), specular cursor light tracking (`radial-gradient` that follows cursor coordinates).
- **Typography**: `Plus Jakarta Sans` for clean, structured typography paired with `JetBrains Mono` for tabular metrics and timestamps.

### Key Views & Navigation Flow

```
┌────────────────────────────────────────────────────────────────────────┐
│                        TOP-CENTER FLOATING HEADER                      │
│   [Dashboard]    [My Library]      [ ( + ) ]    [Analytics]    [Settings]│
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
    ┌───────────────────────────────┼──────────────────────────────┐
    ▼                               ▼                              ▼
┌──────────────┐            ┌──────────────┐               ┌──────────────┐
│  Dashboard   │            │  My Library  │               │ + Creation   │
│ - Topo lines │            │ - Folders    │               │   Studio     │
│ - Tasks list │            │ - Notebooks  │               │ - Note       │
│ - 365d Heat  │            │ - Projects   │               │ - NotebookLM │
│ - Planner    │            │ - Documents  │               │ - OneNote    │
└──────┬───────┘            └──────┬───────┘               │ - Planner    │
       │                           │                       └──────────────┘
       └──────────────┬────────────┘
                      ▼
       ┌──────────────────────────────────────────────────────────────┐
       │                 GOOGLE NOTEBOOKLM WORKSPACE                  │
       │  Left: Sources  │  Center: Grounded Chat  │  Right: Studio   │
       │                 │                         │  [Open Notes ➔]  │
       └──────────────────────────────┬───────────────────────────────┘
                                      │ (Hyprland horizontal slide)
                                      ▼
       ┌──────────────────────────────────────────────────────────────┐
       │ [◂ Back]           ONENOTE FULLSCREEN WORKSPACE              │
       │ Left: Notebooks & Sections │ Center/Right: Multi-Tab Blocks   │
       └──────────────────────────────────────────────────────────────┘
```

### 1. Lander Page & Polygon Simulation
- Fullscreen interactive canvas featuring thousands of interconnected tiny triangular polygons.
- Color interpolation between rich ruby crimson (`#B91C1C`) and radiant gold (`#F59E0B`).
- Physics: Dynamic wave disturbance responding to mouse speed and proximity with smooth spring-damper restitution.
- Hero headline with one-click entry into Dashboard or new NotebookLM workspace.

### 2. Top-Center Header
- Pill-shaped glass bar floating at `top-4` with backdrop blur.
- Centered items: **Dashboard**, **My Library**, dominant **+ Icon** (gold metallic gradient with obsidian border and ring hover effect), **Analytics**, **Settings**.
- Smooth active tab indicators and keyboard shortcuts.

### 3. Dashboard Experience
- **Carved Topographic Background**: Subtle SVG elevation curves that create depth without visual noise.
- **Study Activity Heatmap**: 52-week x 7-day GitHub-style interactive grid displaying daily study hours, tooltips, and streak calculation.
- **Interactive Checklist**: Tasks categorized by urgency with progress completion bar, quick-add '+' input, and priority filtering.
- **Weekly / Daily Planner**: Timeline cards representing active study sprints and milestone deadlines.
- **Universal Search**: Real-time filtering across all notes, sources, and library assets.
- **Apple Liquid Glass Draggable Tiles**: Moveable widgets that maintain layout state and cast dynamic cursor-tracked highlights.

### 4. NotebookLM Experience
- **Source Deck**: Upload or add text excerpts, web links, PDF extracts, lecture notes.
- **Grounded Chat**: Queries synthesize only from active checked sources with inline citation chips (e.g. `[1]`, `[2]`).
- **Studio Quick-Actions**: 1-click generators for Study Guides, FAQ, Briefing Documents, and Podcast/Audio Discussion scripts.
- **'Notes' Dock**: Direct launcher for the OneNote companion workspace.

### 5. OneNote Experience (Hyprland Slide)
- Sliders horizontally into the viewport from the right, taking over the screen.
- A discreet, faint translucent arrow button on the left edge (`[ ‹ ]`) glides the user seamlessly back to the NotebookLM / main workspace.
- **Hierarchical Navigation**: Notebooks column -> Sections column (color-coded tabs) -> Pages list.
- **Rich Block Canvas**: Multi-type blocks (Headings 1-3, Text paragraphs, Interactive checklists, Code blocks with syntax accents, Callout boxes, Quote blocks, Tags).

### 6. Settings & Customization
- **Theme Switcher**: Dark Mode and Light Mode with Tailwind v4 `@custom-variant dark`.
- **10 Curated Palettes**:
  1. *Gold & Obsidian* (Default Aether)
  2. *Crimson Velvet*
  3. *Nordic Frost*
  4. *Emerald Solarium*
  5. *Cyberpunk Amber*
  6. *Midnight Sapphire*
  7. *Travertine Minimal*
  8. *Amethyst Imperial*
  9. *Tokyo Neon Dawn*
  10. *Monochrome Titanium*
- **Model Switcher**: Select between `gemini-3.8-flash` (fast general Q&A) and `gemini-4-argon` (deep reasoning with `thinkingLevel: ThinkingLevel.HIGH`), plus response creativity and thinking level toggles.

### 7. Analytics & Interaction Audits
- **Student Performance Ledger**: Daily/weekly study minutes, reading pace, and completion metrics.
- **Category Time Distribution**: Interactive radar and bar charts tracking minutes across Mathematics, Computer Science, Biology, History, and Literature.
- **Audit Log**: Chronological ledger of all notebook modifications, source citations, and chat inquiries with export options.

***

## 3. Key Product Decisions & Trade-Offs

| Decision | Chosen Approach | Rationale |
| :--- | :--- | :--- |
| **Polygon Substance Engine** | Custom 2D/3D WebGL & Canvas Delaunay Mesh | Pure WebGL/Canvas delivers 60+ FPS across all desktop and laptop GPUs without heavy external 3D asset downloads, perfectly meeting the "really tiny polygons for optimization" requirement. |
| **Glassmorphism & Drag Physics** | Framer Motion + CSS Custom Properties cursor tracker | Provides Apple-like fluid drag-and-drop tile reordering, spring physics, and hardware-accelerated cursor specular reflections. |
| **Workspace Hyprland Sliding** | CSS 3D Transforms with spring curves | Mimics tiling window manager horizontal desktop sliding with zero jank, maintaining state between NotebookLM and OneNote. |
| **Gemini AI Architecture** | Express backend proxy (`server.ts`) with `@google/genai` | Completely secures API keys server-side while supporting both streaming chat, source grounding, and Gemini 4 Argon High Thinking. |
| **Data Persistence** | Reactive LocalStorage state with mock seed fallbacks | Guarantees instant zero-friction trial with rich pre-populated research notes, study guides, and heatmaps that persist across refreshes. |

***

## 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────────────────────┐
│                          VITE REACT FRONTEND                           │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ Navigation State: [lander | dashboard | library | create | ...]   │  │
│  │ Theme & Palette State: 10 Palettes, Dark/Light, Topo overlay     │  │
│  └─────────────────────────────────┬────────────────────────────────┘  │
│                                    │                                   │
│    ┌───────────────┬───────────────┼───────────────┬──────────────┐    │
│    ▼               ▼               ▼               ▼              ▼    │
│ ┌───────┐    ┌───────────┐   ┌───────────┐   ┌───────────┐  ┌────────┐ │
│ │Polygon│    │ Dashboard │   │NotebookLM │   │ OneNote   │  │Floating│ │
│ │Canvas │    │ + Heatmap │   │ + Sources │   │ RichBlock │  │Gemini  │ │
│ └───────┘    └───────────┘   └───────────┘   └───────────┘  └────┬───┘ │
└────────────────────────────────────┬─────────────────────────────┼─────┘
                                     │ fetch('/api/gemini/chat')   │
                                     ▼                             ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        EXPRESS SERVER (server.ts)                      │
│                                                                        │
│  - Endpoint: POST /api/gemini/chat                                     │
│  - Engine: GoogleGenAI SDK                                             │
│  - Models: gemini-3.8-flash | gemini-4-argon (ThinkingLevel.HIGH)      │
│  - Source Grounding Synthesizer & Note Summarizer                      │
└────────────────────────────────────────────────────────────────────────┘
```

### Data Models
- **`NotebookSource`**: `{ id, title, type: 'pdf'|'text'|'url'|'notes', content, tokenCount, selected }`
- **`NoteBlock`**: `{ id, type: 'h1'|'h2'|'text'|'todo'|'code'|'callout'|'quote', content, checked?, language? }`
- **`OneNoteSection`**: `{ id, title, color, pages: [{ id, title, updatedAt, blocks: NoteBlock[] }] }`
- **`StudyActivity`**: `{ date: 'YYYY-MM-DD', count: number, hours: number, subject: string }`
- **`TaskItem`**: `{ id, title, category, priority: 'low'|'medium'|'high', done: boolean, dueDate: string }`
- **`AuditRecord`**: `{ id, timestamp, action, target, metadata }`

***

## 5. Verification & Implementation Order

1. **Server Setup**: Implement Express `server.ts` with `@google/genai` endpoints supporting model switching (`gemini-3.8-flash` and `gemini-4-argon` with high thinking).
2. **Interactive Substance**: Build the red-and-gold tiny polygon wave canvas with mouse repulsion and spring damping.
3. **Core Header & Theming**: Configure Tailwind v4 `@custom-variant dark`, 10 palette presets, and dominant gold '+' header button.
4. **Dashboard & Topo Surface**: Topographic vector curves, 365-day GitHub study heatmap, checklist with progress meter, and planner cards.
5. **NotebookLM Workspace**: Multi-source file manager, grounded chat with citations, study guide generators.
6. **OneNote Workspace & Hyprland Slide**: Multi-level hierarchical notebook (Notebooks > Sections > Pages), rich block editing, and horizontal sliding view with faint back arrow.
7. **Library, Creation Hub, & Analytics**: Category filters, create modal, learning minutes tracker, and audit ledger.
8. **End-to-End Build & Lint**: Run `compile_applet` and `lint_applet` to verify clean compilation.
