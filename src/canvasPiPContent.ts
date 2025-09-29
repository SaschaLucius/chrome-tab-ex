// Content script for Canvas Picture-in-Picture
// Listens for messages {type: 'START_CANVAS_PIP'} and attempts to open the largest visible canvas in PiP.

interface PiPResult {
  ok: boolean;
  reason?: string;
  extra?: any;
}

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
        helper.muted = true;
        helper.playsInline = true;
        helper.style.position = "fixed";
        helper.style.top = "-10000px";
        helper.style.width = "1px";
        helper.style.height = "1px";
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

// Message listener (using window for isolation). In MV3, chrome.runtime.onMessage also available.
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === "START_CANVAS_PIP") {
    startCanvasPiP().then(sendResponse);
    return true; // async
  }
  return false;
});

// Optionally expose for console debugging
(window as any).__startCanvasPiP = startCanvasPiP;
