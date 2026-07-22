interface AutoClosedTab {
  url: string;
  title: string;
  closedAt: number;
  favIconUrl?: string;
}

export {}; // Make this a module to avoid global scope conflicts

const searchInput = document.getElementById("searchInput") as HTMLInputElement;
const tabList = document.getElementById("tabList") as HTMLDivElement;
const countEl = document.getElementById("count") as HTMLDivElement;
const emptyMsg = document.getElementById("emptyMsg") as HTMLDivElement;
const clearAllBtn = document.getElementById("clearAll") as HTMLButtonElement;

let allTabs: AutoClosedTab[] = [];

function timeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (diff < 60000) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString();
}

function renderTabs(tabs: AutoClosedTab[]): void {
  tabList.innerHTML = "";

  if (tabs.length === 0 && allTabs.length === 0) {
    emptyMsg.style.display = "block";
    countEl.textContent = "";
    return;
  }

  emptyMsg.style.display = "none";
  countEl.textContent = `${tabs.length} tab${tabs.length === 1 ? "" : "s"}${
    tabs.length !== allTabs.length ? ` (filtered from ${allTabs.length})` : ""
  }`;

  tabs.forEach((tab) => {
    const item = document.createElement("div");
    item.className = "tab-item";

    const favicon = document.createElement("img");
    favicon.className = "tab-favicon";
    favicon.src = tab.favIconUrl || "images/gt_icon16.png";
    favicon.onerror = () => {
      favicon.onerror = null;
      favicon.src = "images/gt_icon16.png";
    };
    item.appendChild(favicon);

    const info = document.createElement("div");
    info.className = "tab-info";

    const title = document.createElement("div");
    title.className = "tab-title";
    title.textContent = tab.title;
    title.title = tab.title;
    info.appendChild(title);

    const url = document.createElement("div");
    url.className = "tab-url";
    url.textContent = tab.url;
    url.title = tab.url;
    info.appendChild(url);

    item.appendChild(info);

    const time = document.createElement("div");
    time.className = "tab-time";
    time.textContent = timeAgo(tab.closedAt);
    time.title = formatDate(tab.closedAt);
    item.appendChild(time);

    const restoreBtn = document.createElement("button");
    restoreBtn.className = "tab-restore";
    restoreBtn.textContent = "Restore";
    restoreBtn.addEventListener("click", () => {
      restoreBtn.disabled = true;
      restoreBtn.textContent = "...";
      chrome.runtime.sendMessage(
        { action: "restoreAutoClosedTab", url: tab.url, closedAt: tab.closedAt },
        (response) => {
          if (chrome.runtime.lastError || response?.error) {
            restoreBtn.disabled = false;
            restoreBtn.textContent = "Restore";
            return;
          }
          const idx = allTabs.indexOf(tab);
          if (idx >= 0) allTabs.splice(idx, 1);
          filterAndRender();
        }
      );
    });
    item.appendChild(restoreBtn);

    tabList.appendChild(item);
  });
}

function filterAndRender(): void {
  const query = searchInput.value.toLowerCase().trim();
  if (!query) {
    renderTabs(allTabs);
    return;
  }
  const filtered = allTabs.filter(
    (tab) =>
      tab.title.toLowerCase().includes(query) ||
      tab.url.toLowerCase().includes(query)
  );
  renderTabs(filtered);
}

function loadTabs(): void {
  chrome.runtime.sendMessage({ action: "getAutoClosedTabs" }, (response) => {
    if (response && response.tabs) {
      allTabs = response.tabs;
      filterAndRender();
    }
  });
}

searchInput.addEventListener("input", () => {
  filterAndRender();
});

clearAllBtn.addEventListener("click", () => {
  if (confirm("Clear all auto-closed tab history?")) {
    chrome.runtime.sendMessage({ action: "clearAutoClosedTabs" }, () => {
      allTabs = [];
      filterAndRender();
    });
  }
});

loadTabs();
