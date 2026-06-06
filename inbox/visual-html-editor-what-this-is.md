# What This Project Is (plain-language overview)

> **Inbox copy** of the project-root file `C:\Users\Oskari\Documents\web-design\README-WHAT-THIS-IS.md` (kept here per the markdown-routing rule; the canonical copy must live in the project root so the project is self-describing).

**In one sentence:** This is a desktop app that lets someone who knows *nothing* about coding open any web page (`.html` file), **click and drag the things on it around with the mouse**, and have those changes saved back into the real file automatically — with an AI assistant (Claude) sitting right inside the app, already pointed at the right folder, ready to do anything more complicated for you.

You do not need to understand code to use the finished app. That is the whole point.

---

## What you'll be able to do with it (the goal)

Imagine opening a web page and it behaves like a slide in PowerPoint or a design in Canva:

- **Click any element** on the page — a heading, a paragraph, a button, a picture, a table — and it gets a highlight box around it so you know it's selected.
- **Drag it** to move it. A toggle lets you choose, per drag, between:
  - **"Tidy mode" (reorder):** the thing snaps into place in the natural flow of the page. The page stays neat and still works on phones.
  - **"Free mode" (place anywhere):** drop it exactly where you let go of the mouse, like a sticker. Pixel-perfect.
- **It saves itself** back into the actual `.html` file — cleanly, without scrambling the rest of the file.
- **An AI terminal is built in.** Down the bottom of the window is Claude, already "standing in" the folder your file lives in. When you want something drag-and-drop can't do ("make this section blue", "add a contact form", "translate to Finnish"), you ask in plain English and it edits the files for you.

### Later (planned, after the basics work)
- A **sidebar of ready-made building blocks** you drag onto the page: cards, lists, tables, chat boxes, buttons.
- **Drag a photo in**, crop/zoom it there, and the app asks *"what is this — a card? first slide of a gallery? a banner?"* and sets it up, with style choices if there are several.
- **Style variants** — pick a look from a few options instead of writing CSS.
- **Undo/Redo** for everything.

---

## Why it's built this way (plain words)

A normal web page in a browser is locked in a "safety box" — it can't save files on your computer or run programs, for security. That box makes every feature above impossible or clumsy. So this is a **proper desktop app** (double-click an icon). Under the hood it still shows web pages (so what you see is what you get), but it *also* has permission to open/save your files and run the Claude terminal. One window, everything together.

It's built in **layers**, smallest-useful-thing first, so there's always a working version. **You won't use it until it's fully ready** — the layers are just how it's built safely.

---

## Status

- **2026-06-05** — Research complete, build plan written. Starting **Layer 1** (open a file → click + drag elements → auto-save), with the embedded Claude terminal alongside.

Full technical plan: project-root `BUILD-PLAN.md` (inbox copy: `visual-html-editor-build-plan.md`).
Research backing every tool choice: `visual-html-editor-electron-decision-brief.md`.
