// Content script for Canvas Picture-in-Picture
// Listens for messages {type: 'START_CANVAS_PIP'} and attempts to open the largest visible canvas in PiP.

interface PiPResult {
  ok: boolean;
  reason?: string;
  extra?: any;
}

interface InteractiveResult extends PiPResult {}

interface FullPageResult extends PiPResult {}

function showToast(msg: string) {
  const existing = document.getElementById("__gt_canvas_pip_toast");
  if (existing) existing.remove();
  const div = document.createElement("div");
  div.id = "__gt_canvas_pip_toast";
  div.textContent = msg;
  div.style.cssText =
    "position:fixed;z-index:2147483647;top:12px;right:12px;background:#222;color:#fff;padding:8px 12px;font:12px/1.4 sans-serif;border-radius:4px;box-shadow:0 2px 6px rgba(0,0,0,.4);opacity:0;transition:opacity .2s;";
  document.body.appendChild(div);
  requestAnimationFrame(() => (div.style.opacity = "1"));
  setTimeout(() => {
    div.style.opacity = "0";
    setTimeout(() => div.remove(), 300);
  }, 3500);
}

async function startCanvasPiP(): Promise<PiPResult> {
  try {
    const support = {
      docPiP: "pictureInPictureEnabled" in document,
      api:
        typeof (HTMLVideoElement.prototype as any).requestPictureInPicture ===
        "function",
      documentPiP:
        typeof (window as any).documentPictureInPicture !== "undefined",
    };

    // Helper to pick largest visible element from a list
    const pickLargest = <T extends HTMLElement>(list: T[]) =>
      list
        .map((el) => ({
          el,
          rect: el.getBoundingClientRect(),
        }))
        .filter(({ rect }) => rect.width > 0 && rect.height > 0)
        .sort(
          (a, b) => b.rect.width * b.rect.height - a.rect.width * a.rect.height
        )
        .map((r) => r.el)[0];

    // Collect canvases/videos from this document and same-origin iframes
    interface MediaScan {
      canvases: HTMLCanvasElement[];
      videos: HTMLVideoElement[];
    }
    const aggregate: MediaScan = { canvases: [], videos: [] };

    function visible<T extends HTMLElement>(el: T): boolean {
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return (
        rect.width > 0 &&
        rect.height > 0 &&
        style.visibility !== "hidden" &&
        style.display !== "none"
      );
    }

    function scanDoc(doc: Document) {
      try {
        aggregate.canvases.push(
          ...Array.from(doc.querySelectorAll("canvas")).filter(visible)
        );
        aggregate.videos.push(
          ...Array.from(doc.querySelectorAll("video")).filter(visible)
        );
      } catch {}
    }

    scanDoc(document);
    // Same-origin iframe traversal (1 level deep to limit cost)
    const iframes = Array.from(
      document.querySelectorAll("iframe")
    ) as HTMLIFrameElement[];
    const accessibleIframes: HTMLIFrameElement[] = [];
    for (const f of iframes) {
      try {
        if (f.contentDocument) {
          scanDoc(f.contentDocument);
          accessibleIframes.push(f);
        }
      } catch {
        // cross-origin - ignore
      }
    }

    const visibleCanvases = aggregate.canvases;
    let mode: "canvas" | "video" = "canvas";
    let chosenCanvas: HTMLCanvasElement | null = null;
    let chosenVideo: HTMLVideoElement | null = null;
    if (visibleCanvases.length) {
      chosenCanvas = pickLargest(visibleCanvases) as HTMLCanvasElement;
    }

    // If no canvas, fallback to video elements present on the page
    if (!chosenCanvas) {
      const videos = Array.from(
        document.querySelectorAll("video")
      ) as HTMLVideoElement[];
      const candidateVideos = videos.filter((v) => {
        const rect = v.getBoundingClientRect();
        const style = getComputedStyle(v);
        return (
          rect.width > 0 &&
          rect.height > 0 &&
          style.visibility !== "hidden" &&
          style.display !== "none"
        );
      });
      if (candidateVideos.length) {
        mode = "video";
        chosenVideo = pickLargest(candidateVideos) as HTMLVideoElement;
      }
    }

    if (!chosenCanvas && !chosenVideo) {
      // Experimental iframe fallback using Document Picture-in-Picture (DPiP) if available.
      // NOTES:
      // - Standard HTML Video Picture-in-Picture cannot directly display an <iframe>; only <video> elements are eligible.
      // - The new Document Picture-in-Picture API (Chrome 116+) lets us open a new PiP window with arbitrary DOM, so we create a PiP window and embed an iframe clone there.
      // - This will only succeed for same-origin iframe src content due to potential restrictions and because we just set src (no postMessage mirroring).
      // - For cross-origin iframes we cannot access the frame contents, but we can still open a new empty iframe pointing to the same src.
      // - If DPiP is not available or fails, we fall back to reporting no media available.
      const iframeCandidates = iframes.filter(visible);
      if (
        iframeCandidates.length &&
        support.documentPiP &&
        (window as any).documentPictureInPicture?.requestWindow
      ) {
        try {
          const targetIframe = pickLargest(
            iframeCandidates
          ) as HTMLIFrameElement;
          const rect = targetIframe.getBoundingClientRect();
          const dpipWin: any = await (
            window as any
          ).documentPictureInPicture.requestWindow({
            width: Math.round(rect.width),
            height: Math.round(rect.height),
          });
          // Basic styling in DPIP window
          dpipWin.document.body.style.margin = "0";
          // clone or recreate iframe
          const iframeClone = dpipWin.document.createElement("iframe");
          iframeClone.src = targetIframe.src || "about:blank";
          iframeClone.style.width = "100%";
          iframeClone.style.height = "100%";
          iframeClone.style.border = "0";
          dpipWin.document.body.appendChild(iframeClone);
          showToast("Iframe PiP (Document PiP)");
          return { ok: true, extra: { mode: "iframe-dpip", support } };
        } catch (err: any) {
          showToast("No media & iframe DPiP failed");
          return {
            ok: false,
            reason:
              "no-media-and-iframe-dpip-failed:" + (err?.message || "unknown"),
            extra: { support },
          };
        }
      }
      showToast("No canvas/video found");
      return {
        ok: false,
        reason: "no-canvas-or-video",
        extra: {
          support,
          canvases: aggregate.canvases.length,
          videos: aggregate.videos.length,
        },
      };
    }

    // If we have a canvas prefer captureStream; else use existing video directly
    let videoForPiP: HTMLVideoElement | undefined;
    if (chosenCanvas) {
      let helper = document.getElementById(
        "__gt_canvas_pip_video"
      ) as HTMLVideoElement | null;
      if (!helper) {
        helper = document.createElement("video");
        helper.id = "__gt_canvas_pip_video";
        helper.setAttribute("data-gt-purpose", "canvas-pip-helper");
        helper.muted = true;
        helper.playsInline = true;
        // Keep the helper video within viewport (opacity 0) so Chrome's Back to tab can focus original tab
        helper.style.cssText =
          "position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none;z-index:0;";
        helper.addEventListener("enterpictureinpicture", () => {
          try {
            console.debug("[GroupTabs] helper video entered PiP");
          } catch {}
        });
        helper.addEventListener("leavepictureinpicture", () => {
          try {
            console.debug("[GroupTabs] helper video left PiP");
          } catch {}
        });
        document.documentElement.appendChild(helper);
      }
      if (helper.srcObject instanceof MediaStream) {
        helper.srcObject.getTracks().forEach((t) => t.stop());
      }
      const stream = (chosenCanvas as any).captureStream
        ? chosenCanvas.captureStream()
        : (chosenCanvas as any).mozCaptureStream?.();
      if (!stream) {
        // fallback: if we can locate a video now, use it
        const videos = Array.from(
          document.querySelectorAll("video")
        ) as HTMLVideoElement[];
        const candidateVideos = videos.filter((v) => {
          const rect = v.getBoundingClientRect();
          const style = getComputedStyle(v);
          return (
            rect.width > 0 &&
            rect.height > 0 &&
            style.visibility !== "hidden" &&
            style.display !== "none"
          );
        });
        if (candidateVideos.length) {
          mode = "video";
          chosenVideo = pickLargest(candidateVideos) as HTMLVideoElement;
        } else {
          showToast("captureStream unsupported");
          return {
            ok: false,
            reason: "no-capture",
            extra: {
              support,
              picked: { w: chosenCanvas.width, h: chosenCanvas.height },
            },
          };
        }
      } else {
        helper.srcObject = stream;
        videoForPiP = helper;
      }
    }

    if (!videoForPiP) {
      // Using direct video element
      if (!chosenVideo) {
        return { ok: false, reason: "internal-no-video-after-fallback" };
      }
      videoForPiP = chosenVideo;
      // Some sites require muted+play for PiP eligibility
      try {
        await videoForPiP.play().catch(() => {});
      } catch {}
    } else {
      try {
        await videoForPiP.play();
      } catch (err: any) {
        return {
          ok: false,
          reason: "video-play-failed:" + (err?.message || "unknown"),
        };
      }
    }

    if (document.pictureInPictureElement) {
      try {
        await (document as any).exitPictureInPicture();
      } catch {}
    }
    try {
      await (videoForPiP as any).requestPictureInPicture();
    } catch (err: any) {
      showToast("PiP failed");
      return {
        ok: false,
        reason: "pip-failed:" + (err?.message || "unknown"),
        extra: { support, mode },
      };
    }
    showToast(mode === "canvas" ? "Canvas PiP started" : "Video PiP started");
    return { ok: true, extra: { support, mode } };
  } catch (err: any) {
    return { ok: false, reason: "exception:" + (err?.message || "unknown") };
  }
}

// Interactive (Document Picture-in-Picture) implementation
async function startInteractivePiP(): Promise<InteractiveResult> {
  try {
    if (!(window as any).documentPictureInPicture?.requestWindow) {
      showToast("Document PiP not supported");
      return { ok: false, reason: "document-pip-unsupported" };
    }
    // Reuse canvas selection logic (largest visible canvas) or fallback to video snapshot
    const canvases = Array.from(
      document.querySelectorAll("canvas")
    ) as HTMLCanvasElement[];
    const visible = canvases.filter((c) => {
      const r = c.getBoundingClientRect();
      const s = getComputedStyle(c);
      return (
        r.width > 0 &&
        r.height > 0 &&
        s.display !== "none" &&
        s.visibility !== "hidden"
      );
    });
    let sourceCanvas: HTMLCanvasElement | null = null;
    if (visible.length) {
      sourceCanvas = visible.sort(
        (a, b) => b.width * b.height - a.width * a.height
      )[0];
    }
    // If no canvas, attempt to derive one by drawing current video frame (if any)
    if (!sourceCanvas) {
      const videos = Array.from(
        document.querySelectorAll("video")
      ) as HTMLVideoElement[];
      const vVisible = videos.filter((v) => {
        const r = v.getBoundingClientRect();
        const s = getComputedStyle(v);
        return (
          r.width > 0 &&
          r.height > 0 &&
          s.display !== "none" &&
          s.visibility !== "hidden"
        );
      });
      if (vVisible.length) {
        const vid = vVisible.sort(
          (a, b) => b.videoWidth * b.videoHeight - a.videoWidth * a.videoHeight
        )[0];
        // Create an offscreen canvas to mirror video frames
        const off = document.createElement("canvas");
        off.width =
          vid.videoWidth ||
          Math.round(vid.getBoundingClientRect().width) ||
          640;
        off.height =
          vid.videoHeight ||
          Math.round(vid.getBoundingClientRect().height) ||
          360;
        const octx = off.getContext("2d");
        try {
          octx?.drawImage(vid, 0, 0, off.width, off.height);
        } catch {}
        sourceCanvas = off;
        // Continuous mirror
        const mirror = () => {
          if (!documentPictureInPictureWindowOpen()) return; // stop when closed
          try {
            octx?.drawImage(vid, 0, 0, off.width, off.height);
          } catch {}
          requestAnimationFrame(mirror);
        };
        requestAnimationFrame(mirror);
      }
    }
    if (!sourceCanvas) {
      // Full-page fallback: clone body into the PiP window (interactive) if allowed.
      // Approach: We'll create a temporary offscreen canvas to snapshot (first frame) while the live DOM will actually be reproduced in DPiP window.
      // For simplicity we just treat the original body scroll region as the "sourceCanvas" dimensions proxy.
      const w = Math.max(
        document.documentElement.clientWidth,
        window.innerWidth || 800
      );
      const h = Math.max(
        document.documentElement.clientHeight,
        window.innerHeight || 600
      );
      const off = document.createElement("canvas");
      off.width = w;
      off.height = h;
      const octx = off.getContext("2d");
      // We cannot draw DOM directly; keep blank. We'll still open DPiP and populate with cloned DOM.
      sourceCanvas = off;
      const pipWin: Window = await (
        window as any
      ).documentPictureInPicture.requestWindow({
        width: Math.min(Math.max(300, Math.round(w * 0.5)), 1200),
        height: Math.min(Math.max(200, Math.round(h * 0.5)), 900),
      });
      pipWin.document.title = "Interactive PiP - Page";
      pipWin.document.body.style.cssText =
        "margin:0;overflow:auto;background:#111;color:#eee;font:12px sans-serif;";
      // Deep clone (styles via inline copy of computed for top-level is heavy; we'll copy just body children outerHTML for performance)
      // WARNING: Scripts will re-run if inline; acceptable for experimental feature. Could sanitize if needed.
      const container = pipWin.document.createElement("div");
      container.style.cssText = "transform-origin:top left;";
      // Scale down if very large
      const scale = 1; // Potential improvement: dynamic scale for large pages.
      container.style.transform = `scale(${scale})`;
      // Copy body innerHTML (risk: relative resource paths load again)
      container.innerHTML = document.body.innerHTML;
      pipWin.document.body.appendChild(container);
      // (Minimize & title logic removed per user request.)
      showToast("Full page Interactive PiP");
      return { ok: true, extra: { mode: "interactive-fullpage" } };
    }
    const rect = sourceCanvas.getBoundingClientRect();
    const pipWin: Window = await (
      window as any
    ).documentPictureInPicture.requestWindow({
      width: Math.max(200, Math.round(rect.width)),
      height: Math.max(150, Math.round(rect.height)),
    });

    pipWin.document.title = "Interactive PiP";
    pipWin.document.body.style.cssText =
      "margin:0;background:#111;display:flex;align-items:center;justify-content:center;overflow:hidden;";
    const mirrorCanvas = pipWin.document.createElement("canvas");
    mirrorCanvas.width = sourceCanvas.width;
    mirrorCanvas.height = sourceCanvas.height;
    mirrorCanvas.style.width = "100%";
    mirrorCanvas.style.height = "100%";
    mirrorCanvas.style.imageRendering = "pixelated";
    pipWin.document.body.appendChild(mirrorCanvas);
    const mctx = mirrorCanvas.getContext("2d");

    let open = true;
    pipWin.addEventListener("pagehide", () => {
      open = false;
    });
    function documentPictureInPictureWindowOpen() {
      return open;
    }

    const copyFrame = () => {
      if (!open) return;
      try {
        mctx?.drawImage(
          sourceCanvas!,
          0,
          0,
          mirrorCanvas.width,
          mirrorCanvas.height
        );
      } catch {}
      requestAnimationFrame(copyFrame);
    };
    requestAnimationFrame(copyFrame);

    // Event forwarding (pointer + wheel + key) back to original canvas element
    const forwardPointer = (type: string, ev: PointerEvent) => {
      const scaleX = sourceCanvas!.width / mirrorCanvas.clientWidth;
      const scaleY = sourceCanvas!.height / mirrorCanvas.clientHeight;
      const canvasRect = sourceCanvas!.getBoundingClientRect();
      const clientX = canvasRect.left + ev.offsetX * scaleX;
      const clientY = canvasRect.top + ev.offsetY * scaleY;
      const clone = new PointerEvent(type, {
        bubbles: true,
        clientX,
        clientY,
        pointerId: ev.pointerId,
        pointerType: ev.pointerType,
        buttons: ev.buttons,
        ctrlKey: ev.ctrlKey,
        shiftKey: ev.shiftKey,
        altKey: ev.altKey,
        metaKey: ev.metaKey,
      });
      sourceCanvas!.dispatchEvent(clone);
    };
    ["pointerdown", "pointermove", "pointerup", "pointercancel"].forEach(
      (t) => {
        mirrorCanvas.addEventListener(t, (e: any) => forwardPointer(t, e), {
          passive: true,
        });
      }
    );
    mirrorCanvas.addEventListener(
      "wheel",
      (e) => {
        const wheelEvt = new WheelEvent("wheel", e);
        sourceCanvas!.dispatchEvent(wheelEvt);
      },
      { passive: true }
    );
    pipWin.addEventListener("keydown", (e: KeyboardEvent) => {
      const keyEvt = new KeyboardEvent(e.type, e);
      sourceCanvas!.dispatchEvent(keyEvt);
    });

    // (Minimize & title logic removed per user request.)

    showToast("Interactive PiP opened");
    return { ok: true, extra: { mode: "interactive-dpip" } };
  } catch (err: any) {
    showToast("Interactive PiP failed");
    return {
      ok: false,
      reason: "interactive-exception:" + (err?.message || "unknown"),
    };
  }
}

// Full Page Document PiP: clones (lightly) the body into a Document PiP window and keeps it live via mirroring scroll events.
async function startFullPagePiP(): Promise<FullPageResult> {
  try {
    if (!(window as any).documentPictureInPicture?.requestWindow) {
      showToast("Document PiP not supported");
      return { ok: false, reason: "document-pip-unsupported" };
    }
    const w = Math.max(
      document.documentElement.clientWidth,
      window.innerWidth || 800
    );
    const h = Math.max(
      document.documentElement.clientHeight,
      window.innerHeight || 600
    );
    const pipWin: Window = await (
      window as any
    ).documentPictureInPicture.requestWindow({
      width: Math.min(Math.max(400, Math.round(w * 0.6)), 1400),
      height: Math.min(Math.max(300, Math.round(h * 0.6)), 1000),
    });
    pipWin.document.title = "Full Page PiP";
    pipWin.document.body.style.cssText =
      "margin:0;background:#111;color:#eee;font:12px sans-serif;overflow:auto;";
    // Basic style copy (same-origin inline rules)
    Array.from(document.styleSheets).forEach((ss: any) => {
      try {
        const rules = Array.from(ss.cssRules)
          .map((r: any) => r.cssText)
          .join("\n");
        const style = document.createElement("style");
        style.textContent = rules;
        pipWin.document.head.appendChild(style);
      } catch {}
    });
    // Clone body shallow HTML (innerHTML) - scripts may re-run; acceptable for feature. Could sanitize.
    const container = pipWin.document.createElement("div");
    container.innerHTML = document.body.innerHTML;
    container.style.minHeight = "100%";
    pipWin.document.body.appendChild(container);
    // Sync scroll position both ways (throttled)
    let syncing = false;
    const syncFromSource = () => {
      if (syncing) return;
      syncing = true;
      requestAnimationFrame(() => {
        syncing = false;
        pipWin.scrollTo({ top: window.scrollY, left: window.scrollX });
      });
    };
    const syncFromPiP = () => {
      if (syncing) return;
      syncing = true;
      requestAnimationFrame(() => {
        syncing = false;
        window.scrollTo({ top: pipWin.scrollY, left: pipWin.scrollX });
      });
    };
    window.addEventListener("scroll", syncFromSource, { passive: true });
    pipWin.addEventListener("scroll", syncFromPiP, { passive: true });
    pipWin.addEventListener("pagehide", () => {
      window.removeEventListener("scroll", syncFromSource);
    });
    showToast("Full Page PiP opened");
    return { ok: true, extra: { mode: "fullpage-dpip" } };
  } catch (err: any) {
    showToast("Full Page PiP failed");
    return {
      ok: false,
      reason: "fullpage-exception:" + (err?.message || "unknown"),
    };
  }
}

// Message listener (using window for isolation). In MV3, chrome.runtime.onMessage also available.
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === "START_CANVAS_PIP") {
    startCanvasPiP().then(sendResponse);
    return true; // async
  }
  if (msg && msg.type === "START_INTERACTIVE_PIP") {
    startInteractivePiP().then(sendResponse);
    return true;
  }
  if (msg && msg.type === "START_FULLPAGE_PIP") {
    startFullPagePiP().then(sendResponse);
    return true;
  }
  return false;
});

// Optionally expose for console debugging
(window as any).__startCanvasPiP = startCanvasPiP;
(window as any).__startInteractivePiP = startInteractivePiP;
(window as any).__startFullPagePiP = startFullPagePiP;
