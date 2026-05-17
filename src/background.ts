// Background script to track tab activity
interface TabActivity {
  [tabId: string]: number; // timestamp when tab was last accessed
}

interface AutoClosedTab {
  url: string;
  title: string;
  closedAt: number; // timestamp
  favIconUrl?: string;
}

const TAB_ACTIVITY_STORAGE_KEY = "tab_activity_data";
const AUTO_CLOSED_TABS_KEY = "auto_closed_tabs";
const MAX_AUTO_CLOSED_TABS = 200;

const SUSPEND_AFTER_MS = 3 * 24 * 60 * 60 * 1000; // 3 days
const CLOSE_AFTER_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const CHECK_INTERVAL_MINUTES = 30;

// Get tab activity data from storage
async function getTabActivityData(): Promise<TabActivity> {
  const result = await chrome.storage.local.get(TAB_ACTIVITY_STORAGE_KEY);
  return result[TAB_ACTIVITY_STORAGE_KEY] || {};
}

// Save tab activity data to storage
async function saveTabActivityData(data: TabActivity): Promise<void> {
  await chrome.storage.local.set({ [TAB_ACTIVITY_STORAGE_KEY]: data });
}

// Get auto-closed tabs from storage
async function getAutoClosedTabs(): Promise<AutoClosedTab[]> {
  const result = await chrome.storage.local.get(AUTO_CLOSED_TABS_KEY);
  return result[AUTO_CLOSED_TABS_KEY] || [];
}

// Save auto-closed tabs to storage
async function saveAutoClosedTabs(tabs: AutoClosedTab[]): Promise<void> {
  const trimmed = tabs.slice(0, MAX_AUTO_CLOSED_TABS);
  await chrome.storage.local.set({ [AUTO_CLOSED_TABS_KEY]: trimmed });
}

// Record tab activation
async function recordTabActivity(tabId: number): Promise<void> {
  const data = await getTabActivityData();
  data[tabId.toString()] = Date.now();
  await saveTabActivityData(data);
}

// Clean up removed tabs from our tracking data
async function cleanupRemovedTab(tabId: number): Promise<void> {
  const data = await getTabActivityData();
  delete data[tabId.toString()];
  await saveTabActivityData(data);
}

// Update badge with tab count
async function updateBadge(): Promise<void> {
  try {
    const tabs = await chrome.tabs.query({});
    const count = tabs.length;
    chrome.action.setBadgeText({ text: count.toString() });
    chrome.action.setBadgeBackgroundColor({
      color: count > 50 ? "#e53935" : count > 20 ? "#fb8c00" : "#616161",
    });
  } catch (error) {
    console.error("Error updating badge:", error);
  }
}

// Check for inactive tabs and suspend/close them
async function checkInactiveTabs(): Promise<void> {
  try {
    const now = Date.now();
    const data = await getTabActivityData();
    const tabs = await chrome.tabs.query({});

    for (const tab of tabs) {
      if (!tab.id || !tab.url) continue;
      // Skip pinned, active, or non-http tabs
      if (tab.pinned || tab.active) continue;
      if (!tab.url.startsWith("http://") && !tab.url.startsWith("https://"))
        continue;

      const lastAccessed = data[tab.id.toString()] || 0;
      if (lastAccessed === 0) continue;

      const inactiveMs = now - lastAccessed;

      // Auto-close after 7 days
      if (inactiveMs >= CLOSE_AFTER_MS) {
        const closedTab: AutoClosedTab = {
          url: tab.url,
          title: tab.title || tab.url,
          closedAt: now,
          favIconUrl: tab.favIconUrl,
        };
        const closedTabs = await getAutoClosedTabs();
        closedTabs.unshift(closedTab);
        await saveAutoClosedTabs(closedTabs);
        await chrome.tabs.remove(tab.id);
        await cleanupRemovedTab(tab.id);
        continue;
      }

      // Auto-suspend (discard) after 3 days
      if (inactiveMs >= SUSPEND_AFTER_MS && !tab.discarded) {
        try {
          await chrome.tabs.discard(tab.id);
        } catch {
          // Tab may not be discardable (e.g., playing audio)
        }
      }
    }
    await updateBadge();
  } catch (error) {
    console.error("Error checking inactive tabs:", error);
  }
}

// Initialize tab activity tracking for existing tabs when extension starts
async function initializeExistingTabs(): Promise<void> {
  try {
    const tabs = await chrome.tabs.query({});
    const data = await getTabActivityData();
    const now = Date.now();

    // Add timestamp for any tabs we're not tracking yet
    let needsSave = false;
    tabs.forEach((tab) => {
      if (tab.id && !data[tab.id.toString()]) {
        data[tab.id.toString()] = now;
        needsSave = true;
      }
    });

    if (needsSave) {
      await saveTabActivityData(data);
    }
  } catch (error) {
    console.error("Error initializing existing tabs:", error);
  }
}

// Set up periodic alarm for checking inactive tabs
function setupAlarm(): void {
  chrome.alarms.create("checkInactiveTabs", {
    periodInMinutes: CHECK_INTERVAL_MINUTES,
  });
}

// Listen for alarms
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "checkInactiveTabs") {
    await checkInactiveTabs();
  }
});

// Listen for tab activation (user switches to a tab)
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  await recordTabActivity(activeInfo.tabId);
  await updateBadge();
});

// Listen for window focus changes to track tab activity
chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId !== chrome.windows.WINDOW_ID_NONE) {
    try {
      const tabs = await chrome.tabs.query({ active: true, windowId });
      if (tabs[0] && tabs[0].id) {
        await recordTabActivity(tabs[0].id);
      }
    } catch (error) {
      console.error("Error handling window focus change:", error);
    }
  }
});

// Listen for new tabs being created
chrome.tabs.onCreated.addListener(async (tab) => {
  if (tab.id) {
    await recordTabActivity(tab.id);
  }
  await updateBadge();
});

// Listen for tab updates (e.g., navigation)
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // Only track when the tab has finished loading
  if (changeInfo.status === "complete" && tab.active) {
    await recordTabActivity(tabId);
  }
});

// Clean up when tabs are removed
chrome.tabs.onRemoved.addListener(async (tabId) => {
  await cleanupRemovedTab(tabId);
  await updateBadge();
});

// Initialize when extension starts
chrome.runtime.onStartup.addListener(async () => {
  await initializeExistingTabs();
  setupAlarm();
  await updateBadge();
  await checkInactiveTabs();
});

chrome.runtime.onInstalled.addListener(async () => {
  await initializeExistingTabs();
  setupAlarm();
  await updateBadge();
});

// Handle messages from popup/pages
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getTabActivityData") {
    getTabActivityData()
      .then((data) => {
        sendResponse({ data });
      })
      .catch((error) => {
        sendResponse({ error: error.message });
      });
    return true;
  }
  if (request.action === "getAutoClosedTabs") {
    getAutoClosedTabs()
      .then((tabs) => {
        sendResponse({ tabs });
      })
      .catch((error) => {
        sendResponse({ error: error.message });
      });
    return true;
  }
  if (request.action === "restoreAutoClosedTab") {
    const { url, index } = request;
    chrome.tabs
      .create({ url, active: true })
      .then(async () => {
        // Remove from auto-closed list
        const tabs = await getAutoClosedTabs();
        if (index >= 0 && index < tabs.length) {
          tabs.splice(index, 1);
          await saveAutoClosedTabs(tabs);
        }
        sendResponse({ ok: true });
      })
      .catch((error) => {
        sendResponse({ error: error.message });
      });
    return true;
  }
  if (request.action === "clearAutoClosedTabs") {
    saveAutoClosedTabs([])
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ error: error.message }));
    return true;
  }
});
