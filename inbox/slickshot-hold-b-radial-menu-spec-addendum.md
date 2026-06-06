# SlickShot — SPEC ADDENDUM: Hold-B Radial Command Menu

> **Status:** Design-locked, drives implementation.
> **Appends to:** the SlickShot flagship plan (`research-info.md` roadmap + `audit.md`).
> **Slots in at:** new **Tier 1** capability (`radial/` + `hotkey/` modules); hard-depends on the **Tier 0** "replace polling with a registered/low-level hotkey" work (audit.md Quick Win: *"Replace polling with `RegisterHotKey` + a message-loop hook"*). See §6.
> **Target stack:** PySide6 / Qt6 for the new modules (see §5 migration note — the current app is PyQt5 5.15; the radial widget is written so it runs on either, but PySide6/Qt6 is the target for new code).

---

## 0. Scope & one-paragraph pitch

A press-and-hold of a single key (default **B**) opens a frosted-glass radial command wheel at the cursor. Point with the mouse, release to fire — the entire ~50-feature surface of SlickShot (capture, annotate, redact, beautify, OCR, history, share, settings) reachable in one gesture, anywhere in Windows, while SlickShot runs in the background. A quick **tap** of B is never disturbed: the letter "b" still types normally. The menu only appears on a deliberate hold, and the stray "b" is silently retracted **only** when we can prove the focused control is an editable text field.

---

## 1. Feature summary (exact behavior, plain terms)

- **Instant first "b".** The moment B goes down, the *first* "b" passes through to the foreground app with zero added latency (we do not hold keystrokes hostage waiting to see if it's a hold).
- **Hijack the repeat at 0.4 s.** While B stays physically down, the OS would normally start auto-repeating ("bbbbbb…"). SlickShot **suppresses every auto-repeat** of B from the instant of the first keydown, and starts a **0.4 s hold timer**. If B is still down when the timer fires, the menu opens. (Trigger is **time-based**, not "wait for the OS repeat event," because the OS auto-repeat *initial delay* is user-configurable — typically 250 ms–1 s — and would make the open time unpredictable. We suppress the repeats and time the hold ourselves.)
- **Open the menu.** At 0.4 s the radial wheel fades in, cursor-anchored on the monitor under the pointer.
- **Safe-retract only in editable fields.** If — and only if — the focused control is a *detectable* editable text field **and** focus has not changed since the "b" landed, SlickShot deletes that one stray "b" (synthetic Backspace) so the user sees nothing. In a game, a browser canvas, a non-text control, or any app we cannot classify, the "b" is **left in place** (corrupting unknown apps is worse than one visible character). This is an honest, documented limitation, not a bug — see §3.
- **Taps are unaffected.** Press-and-release B in under the hold threshold → the hold timer is cancelled, the suppressed-repeat machinery never engages a second character, the single "b" already delivered stands, no menu. Normal typing of "b", "bb", "abba", etc. is untouched (a *fresh* keydown after a keyup is always passed; only auto-repeat of a *held* key is gated).
- **Global while running.** Works in every application because capture happens at the OS input layer (a system-wide low-level keyboard hook), not via Qt focus. SlickShot needs no window focus for the trigger to fire.
- **Release fires; release-on-nothing cancels.** Releasing B over a slice/sub-slice/favorite executes it; releasing over the dead-zone hub or empty space closes with no action. **Esc** always cancels.

---

## 2. Chosen input architecture

### 2.1 Which hook approach won — and why

The flagship Tier 0 item proposed `RegisterHotKey`. **`RegisterHotKey` cannot implement this feature** and is therefore *not* the trigger mechanism here (it remains correct for the existing one-shot capture chord, Alt+Shift+4). Reasons it loses for Hold-B:

- It fires on a chord *down*; it gives **no key-up event**, so "release to select" is impossible.
- It **cannot suppress auto-repeat** of an otherwise-normal letter key while letting the first press through.
- It steals the key globally and unconditionally — it cannot do the "first 'b' passes, repeats are eaten, tap still types" dance.

**Decision matrix:**

| Approach | First-b passes instantly | Per-event suppress of repeat only | Reliable key-up | Ignore our own injected Backspace | Verdict |
|---|---|---|---|---|---|
| `RegisterHotKey` (Win32) | n/a (chord, not letter) | No | **No** | n/a | ✗ wrong tool |
| `keyboard` (PyPI) | Yes | Partial — global `suppress` + `send`, but blocking model, fragile re-injection, needs admin, no integrity-level info | Yes | Hard | Fallback only |
| `pynput` | Yes | **No clean per-event suppression on Windows** (its win32 backend struggles to consume selectively) | Yes | Hard | ✗ |
| **Raw `SetWindowsHookEx(WH_KEYBOARD_LL)` via `ctypes`** | **Yes** | **Yes — return nonzero to swallow exactly the events we choose** | **Yes** (WM_KEYUP / WM_SYSKEYUP) | **Yes — `LLKHF_INJECTED` flag** | ✅ **WINNER** |

**Winner: a raw Win32 low-level keyboard hook (`WH_KEYBOARD_LL`) installed with `ctypes`.** It is the only option that gives the exact primitives this feature needs:
- **Selective suppression:** returning a nonzero value from the callback drops that single event from the chain — so we pass the first keydown and swallow only the auto-repeats.
- **Real key-up** via `WM_KEYUP`/`WM_SYSKEYUP`, enabling point-and-release.
- **Injection detection:** the `flags` field of `KBDLLHOOKSTRUCT` exposes `LLKHF_INJECTED` (bit 4), so our own synthetic Backspace (and any future synthetic keys) are recognized and never re-processed by our state machine.
- **No extra heavyweight dependency** — pure `ctypes` against `user32`. `keyboard` is documented as a drop-in fallback if we want a higher-level path on some installs, but the primary build uses the raw hook.

> Note on auto-repeat detection: a low-level hook's `KBDLLHOOKSTRUCT` does **not** carry the WM_KEYDOWN lParam "previous-state / repeat-count" bit that a focused window sees. We therefore track B's physical up/down state **ourselves** in the hook: the first `WM_KEYDOWN` with our internal `b_down == False` is a *fresh* press (pass it); every `WM_KEYDOWN` while `b_down == True` is auto-repeat (swallow it). `WM_KEYUP` clears `b_down`.

### 2.2 Event-handling logic (state machine)

States: `IDLE → ARMED → MENU_OPEN → (FIRING | CANCELLED) → IDLE`.

```
HOOK CALLBACK  (runs in the OS input thread — must be fast, see §2.3)
└─ event for VK 'B' (0x42), and NOT LLKHF_INJECTED:

   WM_KEYDOWN:
     if state == IDLE and not b_down:          # FRESH PRESS
        b_down = true
        state = ARMED
        emit signal armed()                    # -> Qt thread starts 0.4s QTimer
        return PASS (0)                         # the FIRST 'b' types instantly
     elif b_down:                               # AUTO-REPEAT while held
        return SUPPRESS (1)                     # eat every repeat 'b'

   WM_KEYUP:
     b_down = false
     if state == ARMED:                         # released BEFORE 0.4s  => it was a TAP
        emit signal disarmed()                  # -> Qt cancels the timer
        state = IDLE
        return PASS (0)                          # nothing to undo; the lone 'b' stands
     elif state == MENU_OPEN:                   # released WITH menu open => SELECT
        inject(VK_B, KEYUP)                      # CORRECTED (§2.6 bug#1): synthetic up so the
                                                 #   app stays key-balanced (it saw 1 down)
        emit signal released()                  # -> Qt fires hovered slice, closes menu
        state = IDLE
        return SUPPRESS (1)                      # consume the PHYSICAL up: menu owns it, no leak
     else:
        return PASS (0)

QT MAIN THREAD  (slot connected to armed())
   start single-shot QTimer(hold_delay_ms = 400)
   on timeout:
     if b_down still true and state == ARMED:
        state = MENU_OPEN
        open_radial_menu_at(cursor_monitor)
        conditional_retract_b()                 # see §2.4
     # else: disarmed() already cancelled us — tap, do nothing

   on disarmed():  cancel the timer
   on released():  execute hovered target (or cancel if hub/void), animate close, state=IDLE
   on Esc:         cancel, animate close, state=IDLE  (works whether or not B still held)
```

Key correctness points:
- **First-b-passes** and **suppress-repeat** are decided purely from our own `b_down` flag — no dependency on OS repeat timing.
- **Early release = tap**: the timer is cancelled before it ever opens the menu; we never injected anything, so there is nothing to retract.
- The **menu-open key-up is consumed** so it does not leak a stray key to the app underneath.

### 2.3 `LowLevelHooksTimeout` constraint → keep the callback non-blocking

Windows budgets each low-level hook callback a hard wall-clock limit. The value lives at `HKEY_CURRENT_USER\Control Panel\Desktop\LowLevelHooksTimeout` (DWORD, milliseconds). **Default since Windows 10 1709 is ~1000 ms; if the value is absent the effective system default is ~300 ms.** If a callback overruns this budget, **Windows silently removes the hook** and input handling reverts to normal — i.e. our trigger would just stop working with no error.

Therefore the callback **must do essentially nothing but bookkeeping**:
- It only flips the `b_down` flag, decides PASS vs SUPPRESS, and **emits a Qt signal** (a thread-safe, queued cross-thread post) for anything that touches UI, timers, or the focused window.
- **No** menu construction, **no** focus inspection, **no** Backspace injection, **no** painting inside the callback. All of that happens on the Qt main thread in the connected slots. The signal carries only primitives (the verb: armed/disarmed/released).
- The hook is installed on a **dedicated thread that runs its own Win32 message pump** (`GetMessage`/`TranslateMessage`/`DispatchMessage`) — `WH_KEYBOARD_LL` requires a message loop on the installing thread. That thread does only the pump + the tiny callback; the Qt event loop is untouched and never blocked.
- We do **not** read/modify `LowLevelHooksTimeout` (writing it needs a re-login and is invasive). We simply stay far under the smallest plausible budget (~300 ms) — our callback is microseconds.

Cross-thread handoff uses `QObject` signals with `Qt.QueuedConnection` (the default across threads), which is the supported, race-free way to wake the Qt thread from the hook thread.

### 2.4 Safe-retract focus detection

When the menu actually opens (timer fired, B still held), we attempt to remove the single stray "b" **on the Qt thread**:

1. **Capture identity early.** At fresh-press time (in the `armed` slot, *before* the menu opens), record `GetForegroundWindow()` and `GetGUIThreadInfo(...).hwndFocus` of that thread — the HWND that actually owns keyboard focus.
2. **Re-check at open.** When retracting, re-query focus. **If the focused HWND changed, abort retract** (the "b" may have landed somewhere we no longer control — focus race; leave it).
3. **Classify the field as editable.** Use a layered, best-effort test, accept-only:
   - **In-process (Qt) fast path:** if `QApplication.focusWidget()` is a `QLineEdit`/`QTextEdit`/`QPlainTextEdit`/editable combo → editable. (Covers SlickShot's own dialogs.)
   - **Out-of-process:** query the focused control's class/role. Win32 `GetClassName` whitelist (`Edit`, `RichEdit*`, `Scintilla`, etc.) **and/or** UI Automation (`IUIAutomation` → focused element → `IsTextPatternAvailable` / `ControlType == Edit/Document`). UIA is the robust path for modern/Electron/Chromium apps; the class whitelist is the cheap first try.
   - If neither confirms an editable text control → **do not retract.**
4. **Check no modifier is held (CRITICAL — §2.6 bug#2).** Before injecting, test `GetAsyncKeyState` for Ctrl/Alt/Shift/Win. **If any modifier is down, skip the retract entirely** — the user pressed a chord (e.g. Ctrl+B), not a plain "b", and a Backspace would be read as **Ctrl+Backspace = delete-word** (data loss), Alt+Backspace = undo, etc.
5. **Retract via injected Backspace** (`SendInput` with a VK_BACK down/up), tagged so our own hook sees `LLKHF_INJECTED` and ignores it. Exactly one Backspace, once (repeats were suppressed, so the app emitted exactly one "b").

This is deliberately conservative: **false negatives (a visible "b" that we failed to remove) are acceptable; false positives (deleting a real character, or word-deleting via a modifier, in another app) are not.** The retract gate is ultimately **(focus-unchanged AND no-modifier-held)**; the editable-field classification in step 3 is a best-effort additional guard, but the cross-process classification is unreliable, so focus-unchanged + no-modifier is the load-bearing condition. See §2.6 for the full verified edge-case set.

### 2.5 How it talks to PySide6

- Hook thread (`hotkey/llhook.py`) owns a `QObject` subclass `HookBridge(QObject)` exposing `armed = Signal()`, `disarmed = Signal()`, `released = Signal()`.
- The Qt-side `RadialController(QObject)` lives on the main thread, holds the `QTimer`, the `RadialMenu` widget, and the retract helper, and connects to those signals (queued).
- No shared mutable state crosses threads except the atomic `b_down` flag (a single `bool`/`ctypes` value, written only in the hook thread, read in the slot guard) — the actual orchestration is message-passing via signals.

---

## 2.6 Hook state-machine — verified edge cases & fixes

> Added after a dedicated adversarial-verification pass (two independent re-derivations + two skeptical break-reports). It found **5 real bugs** in the §2.2 first draft — including a stuck-key bug and a data-loss bug — now fixed here and reflected back into §2.2/§2.4. One speculative "finding" ("apps synthesize their own repeats, so hook-level suppression is the wrong layer") was investigated and **rejected**: standard text fields rely on OS-generated repeats, which the hook suppresses correctly.

The hook runs on its own thread and talks to Qt only via queued signals. All B-key timing is owned by **one** Qt `QTimer` started on the first keydown — never measured on keyup, and never duplicated on both sides.

| # | Real bug | Trigger | Fix |
|---|----------|---------|-----|
| 1 | **B left stuck-down in focused app** | First B-down is passed; repeats suppressed; on release the hook *consumes* the keyup so "the menu owns the release". App now has 1 down / 0 up → B is logically held forever; later keys mis-fire. | App must see **exactly one down and one up**. One down was passed, so when the menu is open, **inject a synthetic B keyup (`SendInput`), then consume the real keyup** so the menu uses the physical release as "select" without it leaking. In the tap case (menu never opened) just **pass** the real keyup. |
| 2 | **Retract becomes Ctrl/Alt/Shift+Backspace (DATA LOSS)** | User holds Ctrl, presses B, holds 0.4 s. Retract injects Backspace while Ctrl is still down → app sees **Ctrl+Backspace = delete word** (destroys text); Alt+Backspace = undo. | Before retracting, check `GetAsyncKeyState` for Ctrl/Alt/Shift/Win. If **any** modifier is down, **skip the retract entirely** (the user meant a chord, not a plain 'b'). |
| 3 | **Retract lands in the wrong app** | During the 0.4 s hold the user clicks/Alt-Tabs away. At timer fire the original focus is gone; a blind Backspace hits whatever now has focus. | At **timer fire** (not at keydown) re-read the foreground/focus window. If it differs from the snapshot taken at keydown, **do not retract**. |
| 4 | **Retract via Qt `sendEvent` is a no-op for foreign apps** | A check for `QLineEdit`/`QTextEdit` only matches Qt widgets, but the 'b' usually went to a non-Qt Win32 app (Notepad), which never receives Qt events → stray 'b' never removed. | Retract must be an **OS-level synthetic keystroke** (`SendInput` Backspace down+up), not a Qt event. Cross-process editable-classification is unreliable, so the load-bearing gate is **(focus-unchanged AND no-modifier-held)**. |
| 5 | **Double / wrong timing source** | Measuring elapsed time on keyup **and** also running a 400 ms QTimer → menu opens ~800 ms late, or only opens after release. | **Single source of truth:** one `QTimer(400 ms)` started on the first keydown; its timeout opens the menu *while B is still held*. Keyup never measures time — it only distinguishes tap (timer pending → cancel) from hold (timer already fired → select/close). |

Non-bug clarifications baked into the code: auto-repeat is detected purely from our local `b_down` flag (`KBDLLHOOKSTRUCT` carries no repeat count); only `vkCode == VK_B` at `HC_ACTION` is ever touched (everything else → `CallNextHookEx`); and because repeats are suppressed the app emitted exactly **one** 'b', so retract is exactly **one** Backspace.

### Corrected hook callback (minimal, authoritative)

```text
state (hook thread):  b_down = False

LowLevelKeyboardProc(nCode, wParam, lParam):
    if nCode != HC_ACTION or lParam.vkCode != VK_B:
        return CallNextHookEx(...)          # never touch other keys

    isDown = wParam in (WM_KEYDOWN, WM_SYSKEYDOWN)
    isUp   = wParam in (WM_KEYUP,   WM_SYSKEYUP)

    # ---- B DOWN ----
    if isDown:
        if b_down:
            return 1                        # OS auto-repeat -> suppress (no bbbb)
        b_down = True
        post_to_qt(B_PRESSED)               # Qt starts the single 400ms QTimer + snapshots focus
        return CallNextHookEx(...)          # let the FIRST 'b' through

    # ---- B UP ----
    if isUp:
        if not b_down:
            return CallNextHookEx(...)      # stray up; never saw its down
        b_down = False
        if not query_qt_menu_open():
            post_to_qt(B_TAP_CANCEL_TIMER)  # TAP: cancel pending timer; the one 'b' stays
            return CallNextHookEx(...)      # PASS the up -> app balanced (1 down / 1 up)
        # HOLD: menu open; app saw 1 down, 0 up so far
        inject(VK_B, KEYUP)                 # synthetic up -> app now balanced
        post_to_qt(B_RELEASED_SELECT)       # menu commits/closes on the physical release
        return 1                            # CONSUME real up: menu owns it, no leak

# ---- Qt main thread ----
on B_PRESSED:
    fg_at_press = GetForegroundWindow(); menu_open = False
    start QTimer(400ms) -> on_hold_fire     # SINGLE timing source

on_hold_fire:                               # B still held at 400ms
    menu_open = True
    mods = GetAsyncKeyState(CTRL|ALT|SHIFT|WIN)
    if (not mods) and GetForegroundWindow() == fg_at_press:
        inject(VK_BACK, DOWN); inject(VK_BACK, UP)   # retract the single stray 'b'
    show_radial_menu()

on B_TAP_CANCEL_TIMER:  stop QTimer; menu_open = False
on B_RELEASED_SELECT:   if menu_open: commit_selection(); close_menu(); menu_open = False
```

Restated rules: **pass the first B-down; suppress repeats via local `b_down`; on release, pass the keyup for a tap but inject-synthetic-up-then-consume for a hold; never retract while a modifier is down or after focus changed; retract is exactly one real `SendInput` Backspace, never a Qt event.**

---

## 3. Failure modes & mitigations

| # | Risk / failure mode | What goes wrong | Mitigation | Residual limitation (honest) |
|---|---|---|---|---|
| 1 | **UAC / elevated foreground window** | A low-level hook from a *medium*-IL SlickShot still **sees** events from an elevated window, but **cannot inject** into it (UIPI blocks `SendInput` into higher-IL targets). Menu opens, but Backspace retract is dropped. | Detect via `LLKHF_LOWER_IL_INJECTED`/integrity comparison; if target is higher-IL, **skip retract** and (optionally) skip suppression entirely so we never half-eat input we can't fully manage. Document: *"For full behavior over elevated apps (Task Manager, admin consoles), run SlickShot as administrator."* | **The stray "b" may remain, and over a focused elevated text box even suppression may be partial, unless SlickShot itself runs elevated.** |
| 2 | **Dropped / missed keys (hook overrun or storm)** | If the callback ever overruns `LowLevelHooksTimeout`, Windows yanks the hook → trigger dies silently. | Callback is microsecond-cheap (§2.3); all work is offloaded. A **watchdog**: re-`SetWindowsHookEx` if `CallNextHookEx`/install handle is found invalid; re-arm on `WM_*` resume; log to `%APPDATA%/SlickShot/log.txt`. | Under extreme system stall the hook can still be removed mid-stroke; watchdog reinstalls but the in-flight gesture is lost. |
| 3 | **Focus race** (focus changes between keydown and menu open) | The "b" landed in field A; by 0.4 s focus is field B → retracting would delete from the wrong control. | Snapshot focus HWND at press; **re-verify at retract; abort if changed** (§2.4). | If focus changes we leave the "b"; user may see one char in field A. Acceptable by design. |
| 4 | **Fullscreen games / exclusive DirectX-OpenGL** | (a) Our Qt overlay can't paint above exclusive-fullscreen renderers; (b) we don't want to eat the gamer's B key. | (a) Detect fullscreen foreground (`GetForegroundWindow` + window style/rect vs monitor); **gracefully degrade** — over non-fullscreen apps `WindowStaysOnTopHint` is enough; for true exclusive-fullscreen overlay we document that a DirectX-hook layer (e.g. a goverlay-style injector) is **out of scope**. (b) **"Pause while gaming"** toggle (default ON): when a fullscreen/exclusive app is foreground, the hook passes B through untouched and never arms. | Over exclusive-fullscreen games the wheel **will not draw** and (with the toggle on) is intentionally disabled. Stated up front. |
| 5 | **Multiple keyboards / external input devices** | Two keyboards, remappers, or macro pads could interleave B events; auto-repeat from one while another taps. | The hook is device-agnostic (system-wide); our up/down state machine is driven by transitions, not device id, so interleaving still resolves to one logical "B held" state. Ignore `LLKHF_INJECTED` events from other tools to avoid feedback loops. | If a second keyboard sends KEYUP for B while the first is physically held, our `b_down` clears early (Windows reports a single logical key state) — rare; gesture simply ends. |
| 6 | **Hook removal by other software / sleep-resume / fast user switch** | AV tools, RDP, session switch, or resume-from-sleep can invalidate the hook. | Watchdog (#2) plus re-install on `WM_WTSSESSION_CHANGE` / power-resume broadcasts; verify on a low-frequency heartbeat. Surface a tray warning if reinstall fails repeatedly. | Brief window after resume where the trigger is dead until reinstall. |
| 7 | **Retract target is not a detectable text field** (browser canvas, custom-drawn control, terminal, game UI) | We can't prove it's editable. | **Skip retract** (§2.4 accept-only classification). | **The single "b" stays visible.** This is the core honest limitation: *retract is best-effort and is skipped wherever focus is not a confirmable editable text control.* |
| 8 | **User holds B with no intent to open (leaning on key)** | Menu opens unexpectedly. | 0.4 s threshold + Esc-to-cancel + release-over-hub = no-op; optional auto-dismiss timeout (configurable). | Minor; tunable via hold-delay setting. |

---

## 4. Chosen radial UI

### 4.1 Concept decision — blended winner

**Base: "Prism — Glass-Morphism Capture Command Center."** It is creative but *tasteful* and reads as a polished professional tool (right for a CleanShot-class app), with a frosted-glass dark wheel, color-coded categories, and a calm spring-in animation.

**Folded in from the other two concepts (best-of blend):**
- **From NEON HUNTER:** the **center-hub Favorites cluster** (4–5 user-pinned quick actions on a true *fast path* — release over a favorite fires immediately, skipping the sub-wheel) and the **"remember last sub-action per category"** affordance.
- **From MINIMAL:** design *restraint* (no particle bursts by default; a clean fade), the explicit **► sub-wheel affordance** on slices that have one, the **monochrome High-Contrast theme** as a first-class alternative, and the **bulletproof octant hit-test math** (`int((angle + 22.5) / 45) % 8`).

Rejected as default: NEON HUNTER's celebratory particle/elastic bounces (too "gamified" for the core audience — offered as an optional "Playful" motion theme) and MINIMAL as the *primary* skin (kept as the High-Contrast/Reduced-Motion theme instead).

### 4.2 Visual language

- Frameless, translucent, always-on-top wheel, ~**400 px** diameter (scales 0.8–1.2× by monitor DPI), cursor-anchored.
- Dark base (`#0a0e27`), **backdrop blur composited once to an offscreen pixmap** (not a live `QGraphicsBlurEffect` per frame — see §5).
- **8 main slices** (45° each), color-coded per category; large icon + 11 pt label; 1–2 px neon ring per category.
- **Center hub** (radius ~40 px): SlickShot "B" glyph + **Favorites** dots; doubles as the **dead-zone / safe-cancel** target.
- **Sub-wheel** (concentric ring, ~140–180 px): fades in (≈180 ms) when a slice with a ► is hovered; holds that category's sub-actions as small segments.
- Hover: slice brightens, icon scales ~1.1×, label bolds. Selection: quick fade-out (≈120 ms); optional flash. **Reduced-Motion** theme snaps with no easing.

### 4.3 Structure — all ~50 features mapped

8 categories (main slice = the single most-common action; sub-wheel = the rest). Center hub = Favorites (user-editable; defaults shown). Cross-listed tools (Color Picker, Crop) intentionally appear in two places for reach.

**1 · CAPTURE — top, Cyan `#00d9ff`** (main: *Region capture*)
Region · Fullscreen · Active-Window · Monitor-Pick · Delay 3 s · Delay 5 s · Delay 10 s · Fixed-Size · Repeat-Last *(9)*

**2 · ANNOTATE — top-right, Rose `#ff006e`** (main: *Pen*) ►
Pen · Arrow · Rectangle · Ellipse · Line · Text · Highlighter · Counter/Step · Crop · Color-Picker *(10)*

**3 · REDACT — right, Amber `#ffb703`** (main: *Pixelate*) ►
Pixelate · Blur · Auto-PII-Redact · Clear-Redactions *(4)*

**4 · BEAUTIFY — bottom-right, Violet `#9d4edd`** (main: *Apply preset*) ►
Padding/Corners/Shadow · Background · Watermark · Aspect (16:9 / 4:3 / 1:1 / custom) · Export-Scale 1×/2× *(5 groups)*

**5 · AI / OCR — bottom, Electric blue `#3a86ff`** (main: *Copy-Text (OCR)*) ►
Copy-Text-OCR · Copy-Region-Text · History-Text-Search · Color-Picker · Ruler · Cloud-Explain (optional) *(6)*

**6 · PREVIEW / EDIT — bottom-left, Mint `#06ffa5`** (main: *Quick-Preview*) ►
Quick-Preview · Pin-to-Screen · Copy · Save · Re-Edit · Delete *(6)*

**7 · HISTORY / SHARE — left, Coral `#ff6b6b`** (main: *Open Library*) ►
Recent-Items · Reveal-in-Explorer · Copy-Path · Save-to-Folder · Discord-Webhook · Custom-HTTP-Upload · S3/R2 (later) *(7)*

**8 · APP / SETTINGS — top-left, Gray `#a8dadc`** (main: *Settings*) ►
Settings · Toggle-B-Menu On/Off · Pause-While-Gaming · Theme · Quit *(5)*

**CENTER HUB · FAVORITES** (fast path, defaults): Copy · Save · Edit · Pin · Delete *(5)*

**Total: ~57 reachable actions** (8 main + ~52 sub/favorite, with Color-Picker and Crop deliberately cross-listed) — comfortably covers the flagship plan's ~50-feature surface with headroom (reserved slots noted in code).

### 4.4 Interaction model

**Primary — point & release:** hold B 0.4 s → wheel opens → move to slice (or its sub-segment, or a favorite) → **release B** to fire. Release over hub/void = cancel.

**Sub-wheels:** hovering a ►-slice for ~180 ms (or flicking outward through it) reveals its sub-wheel; each category **remembers its last-used sub-action** (subtly pre-highlighted, fades after 2 s).

**Favorites fast path:** release over a center-hub favorite executes instantly, no sub-wheel.

**Click fallback (accessibility / gesture-averse):** setting "Click mode" — wheel opens and *stays* on B-hold; user clicks a slice/segment (no need to keep holding). Clicking a ►-slice opens its sub-wheel; clicking outside closes.

**Keyboard fallback (no mouse):** number keys **1–8** select main slices clockwise from top; **arrows** rotate the highlight; **Enter/Space** confirm / open sub-wheel; first-letter jump (e.g. `C` → Capture); **Esc** closes. A **linear "List mode"** (Settings → Accessibility) replaces the wheel with a nested menu for screen-reader users.

### 4.5 ASCII mock

```
                         CAPTURE (1) · Cyan
                         [ Region ]  ►
                                |
        APP (8) · Gray          |          ANNOTATE (2) · Rose
        [ Settings ] ►          |          [ Pen ] ►
                  \             |             /
                   \      ___________      /
                    \    /           \    /
   HISTORY (7) ------(   ●  HUB / B   )------ REDACT (3) · Amber
   [ Library ] ►      \  Favorites:  /        [ Pixelate ] ►
                       \ Cp Sv Ed Pn Dl
                    /    \___________/    \
                   /          |           \
        PREVIEW (6) · Mint     |          BEAUTIFY (4) · Violet
        [ Quick-Preview ] ►    |          [ Preset ] ►
                                |
                          AI/OCR (5) · Blue
                          [ Copy-Text ] ►

   Release B over a slice  -> fire (or open its ►sub-wheel)
   Release B over the HUB   -> cancel (safe dead-zone)
   Esc                      -> cancel anytime

   ── Sub-wheel example: hover CAPTURE ► ───────────────────────
                         Delay-3s
                  Repeat            Monitor-Pick
       Region  ──(  CAPTURE sub-ring  )──  Fullscreen
                  Fixed             Active-Window
                         Delay-5s / Delay-10s

   Affordances:  ► = has sub-wheel        ● = center hub (cancel zone)
   Hub states:   idle "B" glow → hold pulses → hover brightens slice
                 → release fades out (Reduced-Motion: instant)
```

---

## 5. PySide6 implementation notes (incl. every stress-test fix)

> **Migration note:** the existing app is **PyQt5 5.15**. New `radial/` + `hotkey/` modules are written for **PySide6/Qt6** (the flagship target). The radial widget uses only APIs common to both (with a thin `qt_compat` shim for the `Signal`/`pyqtSignal` and enum-namespace differences) so it can land before the whole app migrates. Tier-0 cleanup should schedule the PyQt5→PySide6 move; until then the radial menu can run in a PySide6 child process driven by the hook, or behind the shim.

**Window & rendering**
- `QWidget` with `Qt.FramelessWindowHint | Qt.WindowStaysOnTopHint | Qt.Tool`, `setAttribute(Qt.WA_TranslucentBackground, True)`.
- Draw slices in `paintEvent` with `QPainter` + `QPainterPath.arcTo()`; `setRenderHint(QPainter.Antialiasing)` **set once at init, not per frame** *(fix: smooth sub-100 ms animation)*.
- **Backdrop blur:** grab the screen region once on open, blur to an **offscreen pixmap**, and `drawPixmap` it — do **not** run a live `QGraphicsBlurEffect` every frame *(fix: smooth animation; blur is slow on large areas)*.

**Geometry caching** *(fix: smooth animation)*
- Pre-compute each slice's `QPainterPath`/`QRegion` and label anchor **once at init** (and on resize/DPI change). Never recompute angle points inside `paintEvent`. Bind open/close scale+opacity to a `QPainter` *transform*, not to widget resizes.

**Angle hit-testing** *(fix: click-through edges with capture; multi-level wheels)*
- On mouse move, compute polar coords from center: `r = hypot(dx, dy)`, `theta = degrees(atan2(dy, dx))` normalized to `[0,360)`.
- Main slice index = `int((theta + 22.5) / 45) % 8` (octant-correct, handles the 0°/360° seam and ±22.5° boundaries). Annulus test selects ring: hub `< r_hub`, main `r_hub..r_main`, sub-wheel `r_main..r_sub`.
- **Selective click-through:** in `mousePressEvent`/`mouseMoveEvent`, accept the event only when the cursor is inside an opaque slice/hub region; otherwise `event.ignore()` so it passes to the app beneath. (Qt ≥5.6 does *not* pass through transparent regions by default — we do it explicitly.)

**Invisible capture without stealing app focus** *(fix: invisible mouse capture)*
- **Do not** use `setMouseGrabEnabled()` (it steals focus). Instead install a `QApplication` **event filter** that inspects `QMouseEvent`s: if over menu geometry, handle locally; else pass through. The underlying app keeps focus, which is also why the keyboard trigger (not Qt focus) drives everything.

**Masking / visual correctness** *(fix: window masking crops output)*
- **Do not** use `setMask()` for rendering (it crops the visible pixels). Restrict interaction with the cached `QRegion` hit-test, and for any clipped draw use `QPainter.setClipRegion()` inside `paintEvent` with the **pre-computed** region cache.

**Multi-level sub-wheels as one composited widget** *(fix: multi-level stacking fragility)*
- Render *all* levels in a **single** `QWidget`/`paintEvent`, not separate top-level windows. Track `menu_level ∈ {0,1}` and the active category as plain widget state; auto-advance to the sub-ring on hover. No child-window Z-order/focus juggling.

**Animation**
- `QPropertyAnimation` on custom `_scale`/`_opacity` properties; open ~150 ms (spring `QEasingCurve.OutBack`), close ~100–120 ms. Repaint only on hover/animation tick via `update()` — never a free-running timer. **Reduced-Motion** theme sets durations to 0.

**Cursor-anchored, per-monitor DPI placement** *(fix: per-monitor DPI at cursor)*
- On open: `screen = QGuiApplication.screenAt(QCursor.pos())`; use that screen's `devicePixelRatio()` and `geometry()` to size/place the wheel and to convert cursor → local coords. Cache a `{screen_name: dpr}` dict; reconcile logical vs device pixels so a 100 %-primary / 150 %-secondary setup lands the wheel correctly under the cursor. Clamp the wheel rect inside `availableGeometry()` so it never spills off-screen near edges.

**Fullscreen-overlay degradation** *(fix: fullscreen game overlay)*
- Before opening, check the foreground window for exclusive-fullscreen (style/rect vs monitor). If detected and "Pause while gaming" is on → don't open (and the hook passed B through). Otherwise `WindowStaysOnTopHint` suffices for normal apps; DirectX-hook overlay for exclusive-fullscreen is **documented out of scope**.

**Global key release** *(fix: Qt has no system-wide key events)*
- Provided by §2's `WH_KEYBOARD_LL` hook thread emitting `released()` to the Qt thread — **not** Qt key events (Qt only sees keys for focused windows). This is the stress-test's "use external hook + signal to main thread, don't block the Qt loop" fix, implemented with the raw Win32 hook rather than `pynput`/`keyboard`.

**Dismissal**
- Release-on-target fires + closes; release-on-hub/void closes silently; Esc closes (even if B still held); in Click mode, click-outside closes. Optional auto-dismiss timeout.

---

## 6. Where it slots into the plan

**Tier mapping.** The flagship roadmap is phrased in *Phases*; this addendum uses the requested *Tier* language and bridges them:
- **Tier 0 (prereq, must land first):** the audit's "replace polling with a registered/low-level hotkey + tray + settings + structured logging" stabilization (= research-info Phase 0). The Hold-B feature **depends on** this: it reuses Tier 0's logging (`%APPDATA%/SlickShot/log.txt`), settings store, and tray. **It supersedes the `RegisterHotKey` suggestion for the trigger** (RegisterHotKey stays for the legacy one-shot capture chord; Hold-B uses the low-level hook from §2). The existing 100 ms `GetAsyncKeyState` poll in `slickshot.py:573` is retired by Tier 0.
- **Tier 1 (this feature):** the radial command menu — a self-contained capability that *invokes* existing/roadmapped actions; it does not reimplement them.

**New modules.**
```
slickshot/
  hotkey/
    llhook.py        # WH_KEYBOARD_LL install + message-pump thread + HookBridge(QObject) signals
    retract.py       # focus classification (Qt fast-path, Win32 class whitelist, UIA) + SendInput Backspace
    fullscreen.py    # exclusive-fullscreen / foreground detection (pause-while-gaming)
  radial/
    controller.py    # RadialController(QObject): timer, state, wires hook signals -> menu
    menu.py          # RadialMenu(QWidget): paint, geometry cache, hit-test, animation, DPI placement
    model.py         # category/slice/sub-action registry -> maps to existing action handlers
    theme.py         # Prism (default), High-Contrast (monochrome), Playful; Reduced-Motion flag
```
`radial/model.py` binds slice IDs to the **already-planned** action callables (capture modes, editor tools, redaction, beautify, OCR, history/share, settings) so the wheel is a launcher, not a fork of logic.

**New dependencies.**
- **Required:** none beyond stdlib `ctypes` for the hook + `SendInput`. (Primary path is dependency-free.)
- **For robust out-of-process retract:** `pywin32` (already proposed in research-info's "potential dependency additions") for `GetGUIThreadInfo`/`GetClassName`/UIA convenience, or `comtypes` for raw `IUIAutomation`. Optional.
- **Fallback only:** `keyboard` (PyPI) as the documented alternative hook backend.
- **Migration:** `PySide6` for the new modules (target stack).

**Effort estimate (S / M / L per part):**

| Part | Effort | Notes |
|---|---|---|
| Tier-0 prereq (low-level hotkey infra, if not already done) | **M** | Shared with the broader stabilization. |
| `hotkey/llhook.py` (hook thread, state machine, suppression, signals) | **M** | The careful part; ~120–180 LOC + thorough manual + automated state tests. |
| `hotkey/retract.py` (focus classify + Backspace) | **M** | UIA path adds complexity; class-whitelist MVP is **S**. |
| `hotkey/fullscreen.py` (pause-while-gaming) | **S** | ~40–60 LOC. |
| `radial/menu.py` (paint, geometry cache, hit-test, DPI, click-through) | **L** | Largest UI piece; 400–600 LOC incl. all stress-test fixes. |
| `radial/controller.py` + `model.py` (wiring, action binding) | **M** | Maps ~57 actions to handlers. |
| `radial/theme.py` (Prism / High-Contrast / Reduced-Motion) | **S** | Mostly data + palette. |
| Animation polish + accessibility (keyboard nav, List mode) | **M** | |
| **Total** | **~L** | Roughly 2–3 focused weeks for production quality, matching the concept feasibility estimates. |

---

## 7. Settings (all configurable)

Stored in the Tier-0 settings file (`%APPDATA%/SlickShot/settings.json`), surfaced in the Settings dialog and the wheel's **APP** category.

| Setting | Default | Notes |
|---|---|---|
| **Enable Hold-B menu** | On | Master toggle; also on the wheel + tray. |
| **Trigger key** | `B` | Remappable to **any** key — *including non-letter keys* (e.g. `` ` ``, F-keys, CapsLock, a mouse side-button). For non-typing keys, retract is auto-disabled (nothing to undo). |
| **Hold delay** | **0.4 s** | Time B must be held before the menu opens (range ~0.15–1.0 s). |
| **Safe-retract stray key** | On | Remove the first typed char when the menu opens — *only* in confirmable editable fields (§2.4). Power users can disable entirely. |
| **Selection mode** | Point-and-release | vs **Click mode** (wheel stays open; click to pick) — the accessibility / gesture-averse path. |
| **Pause while gaming** | On | Suppress the trigger (pass key through) when an exclusive-fullscreen app is foreground (§3-#4). |
| **Theme** | Prism (glass dark) | + **High-Contrast** (monochrome, WCAG-AA) and **Playful** (particles/elastic). |
| **Reduced motion** | Off (auto-on if OS requests) | Snaps all animation to instant. |
| **Favorites (center hub)** | Copy, Save, Edit, Pin, Delete | User-editable, 4–5 slots. |
| **Auto-dismiss timeout** | Off | Optional safety: close the menu if held with no action for N s. |
| **Run elevated for elevated-app retract** | Off | Documented opt-in; needed for full behavior over admin windows (§3-#1). |
| **Wheel size / DPI scale** | Auto (0.8–1.2×) | Manual override per preference. |
| **List mode (accessibility)** | Off | Linear nested menu instead of the radial wheel, for screen readers. |

---

### Sources (technical grounding)
- LowLevelKeyboardProc / suppression return value — Microsoft Learn: https://learn.microsoft.com/en-us/windows/win32/winmsg/lowlevelkeyboardproc
- KBDLLHOOKSTRUCT flags (LLKHF_INJECTED / LLKHF_LOWER_IL_INJECTED) — Microsoft Learn: https://learn.microsoft.com/en-us/windows/win32/api/winuser/ns-winuser-kbdllhookstruct
- `LowLevelHooksTimeout` location/default (HKCU\Control Panel\Desktop; ~1000 ms since 1709, ~300 ms if unset) — https://renenyffenegger.ch/notes/Windows/registry/tree/HKEY_CURRENT_USER/Control-Panel/Desktop/index and https://github.com/MicrosoftDocs/feedback/issues/2225
