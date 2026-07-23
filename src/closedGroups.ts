function timeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  if (diff < 60000) return "just now";
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

/**
 * chrome.sessions reports lastModified in seconds since the epoch, but some
 * browser versions return milliseconds. Normalize to milliseconds.
 */
function normalizeSessionTimestamp(lastModified: number): number {
  // Values before ~2001-09 in ms (1e12) can only be second-based timestamps
  return lastModified < 1e12 ? lastModified * 1000 : lastModified;
}

type WindowSession = chrome.sessions.Session & {
  window: chrome.windows.Window;
};

function getWindowSessions(): Promise<WindowSession[]> {
  return new Promise((resolve) => {
    chrome.sessions.getRecentlyClosed(
      { maxResults: chrome.sessions.MAX_SESSION_RESULTS },
      (sessions) => {
        resolve(
          sessions.filter(
            (s): s is WindowSession => !!s.window && !!s.window.tabs?.length
          )
        );
      }
    );
  });
}

function renderList(sessions: WindowSession[]): void {
  const listEl = document.getElementById("list")!;
  const emptyEl = document.getElementById("emptyMsg")!;

  listEl.innerHTML = "";

  if (sessions.length === 0) {
    emptyEl.style.display = "block";
    return;
  }
  emptyEl.style.display = "none";

  sessions.forEach((session) => {
    const tabs = session.window.tabs || [];
    const tabCount = tabs.length;
    const timestamp = normalizeSessionTimestamp(session.lastModified);

    const recordEl = document.createElement("div");
    recordEl.className = "record";

    // Header row
    const headerEl = document.createElement("div");
    headerEl.className = "recordHeader";

    const expandEl = document.createElement("span");
    expandEl.className = "expandIcon";
    expandEl.textContent = "▸";
    headerEl.appendChild(expandEl);

    const iconEl = document.createElement("span");
    iconEl.className = "typeIcon";
    iconEl.textContent = "🪟";
    headerEl.appendChild(iconEl);

    const titleEl = document.createElement("span");
    titleEl.className = "recordTitle";
    // Use the title of the first tab as a label
    const firstTitle = tabs[0]?.title || tabs[0]?.url || "Window";
    titleEl.textContent = firstTitle;
    titleEl.title = firstTitle;
    headerEl.appendChild(titleEl);

    const metaEl = document.createElement("span");
    metaEl.className = "recordMeta";
    metaEl.textContent = `${tabCount} tab${
      tabCount === 1 ? "" : "s"
    } · ${timeAgo(timestamp)}`;
    headerEl.appendChild(metaEl);

    const actionsEl = document.createElement("div");
    actionsEl.className = "recordActions";

    const restoreBtn = document.createElement("button");
    restoreBtn.className = "btnRestore";
    restoreBtn.textContent = "Restore";
    restoreBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const sessionId = session.window.sessionId;
      if (!sessionId) {
        console.error("Session has no sessionId; cannot restore");
        return;
      }
      restoreBtn.disabled = true;
      restoreBtn.textContent = "…";
      try {
        await chrome.sessions.restore(sessionId);
        // Refresh the list
        const updated = await getWindowSessions();
        renderList(updated);
      } catch (err) {
        console.error("Restore failed:", err);
        restoreBtn.disabled = false;
        restoreBtn.textContent = "Restore";
      }
    });
    actionsEl.appendChild(restoreBtn);
    headerEl.appendChild(actionsEl);
    recordEl.appendChild(headerEl);

    // Expandable tab list
    const tabListEl = document.createElement("div");
    tabListEl.className = "tabList";

    tabs.forEach((tab) => {
      const tabEl = document.createElement("div");
      tabEl.className = "tabItem";

      if (tab.favIconUrl) {
        const img = document.createElement("img");
        img.src = tab.favIconUrl;
        img.onerror = () => (img.style.display = "none");
        tabEl.appendChild(img);
      } else {
        const ph = document.createElement("span");
        ph.style.cssText = "width:14px;height:14px;display:inline-block";
        tabEl.appendChild(ph);
      }

      const titleSpan = document.createElement("span");
      titleSpan.className = "tabItemTitle";
      titleSpan.textContent = tab.title || tab.url || "";
      titleSpan.title = tab.url || "";
      tabEl.appendChild(titleSpan);

      const urlSpan = document.createElement("span");
      urlSpan.className = "tabItemUrl";
      try {
        urlSpan.textContent = new URL(tab.url || "").hostname;
      } catch {
        urlSpan.textContent = tab.url || "";
      }
      tabEl.appendChild(urlSpan);

      tabListEl.appendChild(tabEl);
    });

    headerEl.addEventListener("click", () => {
      const expanded = tabListEl.classList.toggle("expanded");
      expandEl.textContent = expanded ? "▾" : "▸";
    });

    recordEl.appendChild(tabListEl);
    listEl.appendChild(recordEl);
  });
}

async function init(): Promise<void> {
  try {
    const sessions = await getWindowSessions();
    renderList(sessions);
  } catch (err) {
    console.error("Failed to load closed windows:", err);
  }
}

init();
