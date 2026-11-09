# Aether Workspace System — Implementation Plan

## Overview
This plan covers 7 distinct features requested by the user. They are ordered by dependency — quick fixes first, then the large workspace architecture.

---

## Phase 1: Quick Fixes (No Architecture Changes)

### 1.1 Black Night Lander — Truly Black with Black Glow
- **File**: `src/data/mockData.ts` — change `black-night` palette `bgDark` from `#040404` to `#000000`
- **File**: `src/App.tsx` — when palette is `black-night`, set `--button-glow-start` and `--button-glow-end` to deep black tones for the lander glow button
- **File**: `src/components/PolygonCanvas.tsx` — for `black-night`, the glow button vars should use black tones, hero text gradient should be subtle silver-to-charcoal

### 1.2 Window Change Animation — Blur Should Decrease as Content Appears  
- **File**: `src/index.css` — the `fullscreenFrostSweep` keyframes currently animate only opacity (0→1→1→0). The `backdrop-filter: blur(28px)` is static. Need to animate the blur from 28px down to 0px as the content appears, or alternatively animate the overlay's opacity so the blur naturally fades.
- Current issue: the blur stays at full 28px throughout the animation, then vanishes abruptly. Fix: make the `backdrop-filter` blur decrease smoothly in the latter half.

### 1.3 OneNote — "New Section" Button & "Create Notebook" in Dropdown
- **File**: `src/components/OneNoteWorkspace.tsx`
  - The `handleAddSection` already works (uses `prompt()`). The button at line 4046 already calls it. Verify it works.
  - Add a "Create Notebook" button at the bottom of the notebook dropdown popover (line ~4004).
  - Create `handleAddNotebook` function.

---

## Phase 2: Workspace Architecture (Large Feature)

### 2.1 Type System Updates
- **File**: `src/types/index.ts`
  - Add `Workspace` interface: `{ id, name, createdAt, notebookSources, oneNoteNotebooks, geminiConversations }`
  - Update `ActiveTab` to include `'workspace'` and remove `'notebooklm'`
  - Update `LibraryItem.type` to include `'workspace'`

### 2.2 Header — Replace "NotebookLM" with "Workspace"
- **File**: `src/components/Header.tsx`
  - Change the NotebookLM button to "Workspace"
  - Change icon from `BookOpen` to `Layers` or similar workspace icon
  - When clicked: trigger zoom-out animation on current view, slide up header, slide down workspace selector bar

### 2.3 Workspace Selector Bar
- New concept: When "Workspace" is clicked in header, current view zooms out slightly, top header slides up, and a new bar slides down showing available workspaces as cards
- Each workspace card shows a miniature preview on hover (zoomed-out glimpse)
- Selecting a workspace loads its synced NotebookLM, OneNote, and Gemini data

### 2.4 Library — "Add Workspace" Card in Folders
- **File**: `src/components/LibraryView.tsx`
  - Add a dotted-border card at the end of each folder's items grid
  - Card text: "Add Workspace" with theme-matching colors
  - On click: show recently created workspaces to add to folder

### 2.5 Untitled Workspaces Folder
- **File**: `src/App.tsx`
  - Add "Untitled Workspaces" to default folders
  - New workspaces created are auto-stored there

### 2.6 Data Sync
- Each workspace encapsulates its own NotebookLM sources, OneNote notebooks, and Gemini conversations
- Switching workspaces swaps the active data set

---

## Execution Order
1. Phase 1.1 — Black Night lander (immediate)
2. Phase 1.2 — Frost sweep blur fix (immediate) 
3. Phase 1.3 — OneNote section/notebook creation (immediate)
4. Phase 2.1–2.6 — Workspace system (large, sequential)
