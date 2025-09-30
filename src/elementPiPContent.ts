// Content script to allow user to pick any element on the page and open it in a Document Picture-in-Picture window
// Triggered via message {type: 'START_ELEMENT_PIP'}.

interface ElementPiPResult {
  ok: boolean;
  reason?: string;
  extra?: any;
}

const TOOL_ID = "__gt_elem_pip_tool";
let overlay: HTMLDivElement | null = null;
let highlight: HTMLDivElement | null = null;
let currentEl: HTMLElement | null = null;
let active = false;

function ensureOverlay() {
  if (overlay) return overlay;
  overlay = document.createElement("div");
  overlay.id = TOOL_ID;
  overlay.style.cssText = [
    "position:fixed",
    "inset:0",
    "z-index:2147483646",
    "pointer-events:none",
  ].join(";");
  document.documentElement.appendChild(overlay);
  highlight = document.createElement("div");
  highlight.style.cssText = [
    "position:absolute",
    "border:2px solid #4da3ff",
    "background:rgba(77,163,255,.15)",
    "box-shadow:0 0 0 1px rgba(255,255,255,.4) inset,0 0 4px 2px rgba(0,123,255,.4)",
    "pointer-events:none",
    "border-radius:4px",
    "mix-blend-mode:normal",
  ].join(";");
  overlay.appendChild(highlight);
  const hint = document.createElement("div");
  hint.textContent =
    "Click element for PiP • ESC to cancel • Shift for precise mode";
  hint.style.cssText = [
    "position:fixed",
    "left:50%",
    "top:12px",
    "transform:translateX(-50%)",
    "background:#111",
    "color:#fff",
    "font:12px/1.3 system-ui,sans-serif",
    "padding:6px 10px",
    "border-radius:4px",
    "box-shadow:0 2px 6px rgba(0,0,0,.4)",
    "pointer-events:none",
    "user-select:none",
    "letter-spacing:.5px",
    "opacity:.9",
  ].join(";");
  overlay.appendChild(hint);
  return overlay;
}

function cleanup() {
  active = false;
  document.removeEventListener("mousemove", onMove, true);
  document.removeEventListener("click", onClick, true);
  document.removeEventListener("keydown", onKey, true);
  document.removeEventListener("scroll", onScroll, true);
  overlay?.remove();
  overlay = null;
  highlight = null;
  currentEl = null;
}

function updateHighlight() {
  if (!highlight || !currentEl) return;
  const r = currentEl.getBoundingClientRect();
  highlight.style.top = r.top + "px";
  highlight.style.left = r.left + "px";
  highlight.style.width = r.width + "px";
  highlight.style.height = r.height + "px";
}

function pickElementAt(x: number, y: number, precise: boolean) {
  let el = document.elementFromPoint(x, y) as HTMLElement | null;
  if (!el) return;
  if (!precise) {
    // climb until a visually distinct block (heuristic)
    while (el && el.parentElement && el.getBoundingClientRect().height < 25) {
      el = el.parentElement as HTMLElement;
    }
  }
  currentEl = el;
  updateHighlight();
}

function onMove(e: MouseEvent) {
  const precise = e.shiftKey;
  pickElementAt(e.clientX, e.clientY, precise);
}

async function openElementInPiP(el: HTMLElement): Promise<ElementPiPResult> {
  if (!(window as any).documentPictureInPicture?.requestWindow) {
    return { ok: false, reason: "document-pip-unsupported" };
  }
  const rect = el.getBoundingClientRect();
  const w = Math.max(120, Math.min(800, Math.round(rect.width || 400)));
  const h = Math.max(90, Math.min(600, Math.round(rect.height || 300)));
  let prevParent: Node | null = el.parentNode;
  let prevNext: Node | null = el.nextSibling;
  const pipWin: Window = await (
    window as any
  ).documentPictureInPicture.requestWindow({ width: w, height: h });
  // Copy minimal critical stylesheets (inline stylesheets only to avoid CORS)
  Array.from(document.styleSheets).forEach((ss: any) => {
    try {
      const rules = [...ss.cssRules].map((r: any) => r.cssText).join("\n");
      const style = document.createElement("style");
      style.textContent = rules;
      pipWin.document.head.appendChild(style);
    } catch {}
  });
  pipWin.document.body.style.margin = "0";
  pipWin.document.body.style.background =
    getComputedStyle(document.body).backgroundColor || "#111";
  pipWin.document.body.appendChild(el);
  pipWin.addEventListener("pagehide", () => {
    // restore element
    if (prevParent) {
      if (prevNext) prevParent.insertBefore(el, prevNext);
      else prevParent.appendChild(el);
    }
  });
  return { ok: true };
}

function onClick(e: MouseEvent) {
  if (!currentEl) return;
  e.preventDefault();
  e.stopPropagation();
  const el = currentEl;
  cleanup();
  openElementInPiP(el).catch((err) => console.error("Element PiP failed", err));
}

function onKey(e: KeyboardEvent) {
  if (e.key === "Escape") {
    e.preventDefault();
    e.stopPropagation();
    cleanup();
  }
  if (e.key === "Enter" && currentEl) {
    e.preventDefault();
    e.stopPropagation();
    const el = currentEl;
    cleanup();
    openElementInPiP(el).catch((err) => console.error(err));
  }
}

function onScroll() {
  updateHighlight();
}

async function startElementSelection(): Promise<ElementPiPResult> {
  if (active) return { ok: false, reason: "already-active" };
  active = true;
  ensureOverlay();
  document.addEventListener("mousemove", onMove, true);
  document.addEventListener("click", onClick, true);
  document.addEventListener("keydown", onKey, true);
  document.addEventListener("scroll", onScroll, true);
  return { ok: true };
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === "START_ELEMENT_PIP") {
    startElementSelection().then(sendResponse);
    return true;
  }
  return false;
});

// Expose for debug
(window as any).__startElementPiP = startElementSelection;
