// Background script to track tab activity
interface TabActivity {
  [tabId: string]: number; // timestamp when tab was last accessed
}

const TAB_ACTIVITY_STORAGE_KEY = "tab_activity_data";

// Get tab activity data from storage
async function getTabActivityData(): Promise<TabActivity> {
  const result = await chrome.storage.local.get(TAB_ACTIVITY_STORAGE_KEY);
  return result[TAB_ACTIVITY_STORAGE_KEY] || {};
}

// Save tab activity data to storage
async function saveTabActivityData(data: TabActivity): Promise<void> {
  await chrome.storage.local.set({ [TAB_ACTIVITY_STORAGE_KEY]: data });
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

// Listen for tab activation (user switches to a tab)
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  await recordTabActivity(activeInfo.tabId);
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
});

// Initialize when extension starts
chrome.runtime.onStartup.addListener(async () => {
  await initializeExistingTabs();
});

chrome.runtime.onInstalled.addListener(async () => {
  await initializeExistingTabs();
});

// Export function to get tab activity data for use in popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getTabActivityData") {
    getTabActivityData()
      .then((data) => {
        sendResponse({ data });
      })
      .catch((error) => {
        sendResponse({ error: error.message });
      });
    return true; // Keep message channel open for async response
  }
});
