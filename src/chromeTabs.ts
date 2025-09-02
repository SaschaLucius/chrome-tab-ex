import { getDomainName, getDomainNameIgnoreSubDomain } from "./url";

export function queryTabs(
  options: chrome.tabs.QueryInfo
): Promise<chrome.tabs.Tab[]> {
  return chrome.tabs.query(options);
}

export function getActiveTab(): Promise<chrome.tabs.Tab[]> {
  return chrome.tabs.query({ currentWindow: true, active: true });
}

export function getPinnedTabs(): Promise<chrome.tabs.Tab[]> {
  return chrome.tabs.query({ currentWindow: true, pinned: true });
}

/**
 * sortTabsByURL sorts tabs by URL
 * @param tabs
 * @returns
 */
export function sortTabsByURL(tabs: chrome.tabs.Tab[]): chrome.tabs.Tab[] {
  tabs.sort((a, b) => {
    const urlA = a.url === undefined ? "" : a.url.toLowerCase();
    const urlB = b.url === undefined ? "" : b.url.toLowerCase();
    if (urlA < urlB) {
      return -1;
    }
    if (urlA > urlB) {
      return 1;
    }
    return 0;
  });
  return tabs;
}

/**
 * sortTabsByDomainName sorts tabs by domain name.
 * @param tabs
 * @returns
 */
export function sortTabsByDomainName(
  tabs: chrome.tabs.Tab[]
): chrome.tabs.Tab[] {
  tabs.sort((a, b) => {
    const groupTitleA =
      a.url === undefined ? "" : getDomainName(a.url.toLowerCase());
    const groupTitleB =
      b.url === undefined ? "" : getDomainName(b.url.toLowerCase());
    if (groupTitleA < groupTitleB) {
      return -1;
    }
    if (groupTitleA > groupTitleB) {
      return 1;
    }
    return 0;
  });
  return tabs;
}

/**
 * sortTabsByDomainNameIgnoreSubDomain sorts tabs by domain name.
 * @param tabs
 * @returns
 */
export function sortTabsByDomainNameIgnoreSubDomain(
  tabs: chrome.tabs.Tab[]
): chrome.tabs.Tab[] {
  tabs.sort((a, b) => {
    const groupTitleA =
      a.url === undefined
        ? ""
        : getDomainNameIgnoreSubDomain(a.url.toLowerCase());
    const groupTitleB =
      b.url === undefined
        ? ""
        : getDomainNameIgnoreSubDomain(b.url.toLowerCase());
    if (groupTitleA < groupTitleB) {
      return -1;
    }
    if (groupTitleA > groupTitleB) {
      return 1;
    }
    return 0;
  });
  return tabs;
}

/**
 * moveTabs moves tabs.
 * @param tabs
 */
export function moveTabs(tabs: chrome.tabs.Tab[]): void {
  let i = 0;
  tabs.forEach((tab) => {
    if (tab.id === undefined) {
      return;
    }
    chrome.tabs.move(tab.id, { index: i });
    i++;
  });
}

export function groupTabs(tabIDs: number[]): Promise<number> {
  return chrome.tabs.group({ tabIds: tabIDs });
}

export function ungroupTabs(tabsIDs: number[]): void {
  chrome.tabs.ungroup(tabsIDs);
}

export function removeTab(tabID: number): void {
  chrome.tabs.remove(tabID);
}

/**
 * getAllWindows gets all browser windows
 * @returns Promise<chrome.windows.Window[]>
 */
export function getAllWindows(): Promise<chrome.windows.Window[]> {
  return chrome.windows.getAll({ populate: true, windowTypes: ["normal"] });
}

/**
 * getCurrentWindow gets the current window
 * @returns Promise<chrome.windows.Window>
 */
export function getCurrentWindow(): Promise<chrome.windows.Window> {
  return chrome.windows.getCurrent({ populate: true });
}

/**
 * moveTabsToWindow moves tabs to a specific window
 * @param tabIds Array of tab IDs to move
 * @param windowId Target window ID
 * @returns Promise<chrome.tabs.Tab[]>
 */
export function moveTabsToWindow(
  tabIds: number[],
  windowId: number
): Promise<chrome.tabs.Tab[]> {
  return chrome.tabs.move(tabIds, { windowId: windowId, index: -1 });
}

/**
 * closeWindow closes a browser window
 * @param windowId Window ID to close
 * @returns Promise<void>
 */
export function closeWindow(windowId: number): Promise<void> {
  return chrome.windows.remove(windowId);
}

/**
 * validateWindowExists checks if a window still exists
 * @param windowId Window ID to check
 * @returns Promise<boolean>
 */
async function validateWindowExists(windowId: number): Promise<boolean> {
  try {
    await chrome.windows.get(windowId);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * mergeAllWindows merges all browser windows into the current window
 */
export async function mergeAllWindows(): Promise<void> {
  try {
    const currentWindow = await getCurrentWindow();
    const allWindows = await getAllWindows();

    // Filter out the current window
    const otherWindows = allWindows.filter(
      (window) => window.id !== currentWindow.id
    );

    if (otherWindows.length === 0) {
      console.log("No other windows to merge");
      return;
    }

    // Collect all tabs from other windows
    const tabsToMove: number[] = [];
    const windowsToClose: number[] = [];

    for (const window of otherWindows) {
      if (window.tabs && window.id) {
        // Collect all non-pinned tab IDs from this window
        const tabIds = window.tabs
          .filter((tab) => tab.id !== undefined && !tab.pinned)
          .map((tab) => tab.id as number);

        // Only add to close list if window has tabs to move
        if (tabIds.length > 0) {
          tabsToMove.push(...tabIds);
          windowsToClose.push(window.id);
        }
      }
    }

    // Move all tabs to current window
    if (tabsToMove.length > 0 && currentWindow.id) {
      await moveTabsToWindow(tabsToMove, currentWindow.id);
    }

    // Close empty windows with better validation
    let successfullyClosedCount = 0;
    for (const windowId of windowsToClose) {
      try {
        // Validate that the window still exists before trying to close it
        const windowExists = await validateWindowExists(windowId);
        if (!windowExists) {
          console.log(`Window ${windowId} no longer exists, skipping closure`);
          continue;
        }

        // Double-check that the window is actually empty of non-pinned tabs
        const window = await chrome.windows.get(windowId, { populate: true });
        const hasNonPinnedTabs =
          window.tabs?.some((tab) => !tab.pinned) ?? false;

        if (hasNonPinnedTabs) {
          console.log(
            `Window ${windowId} still has non-pinned tabs, skipping closure`
          );
          continue;
        }

        await closeWindow(windowId);
        successfullyClosedCount++;
        console.log(`Successfully closed window ${windowId}`);
      } catch (error) {
        // More specific error logging
        if (error instanceof Error) {
          console.warn(`Failed to close window ${windowId}: ${error.message}`);
        } else {
          console.warn(`Failed to close window ${windowId}:`, error);
        }
      }
    }

    console.log(
      `Merged ${tabsToMove.length} tabs from ${windowsToClose.length} windows (${successfullyClosedCount} windows closed successfully)`
    );
  } catch (error) {
    console.error("Error merging windows:", error);
    throw error;
  }
}

/**
 * copyAllUrlsToClipboard copies all URLs from the current window to clipboard
 * Each URL is separated by a newline
 */
export async function copyAllUrlsToClipboard(): Promise<void> {
  try {
    const tabs = await chrome.tabs.query({ 
      currentWindow: true 
    });
    
    const urls = tabs
      .filter(tab => tab.url && (tab.url.startsWith('http://') || tab.url.startsWith('https://')))
      .map(tab => tab.url!)
      .join('\n');
    
    if (urls) {
      await navigator.clipboard.writeText(urls);
      console.log(`Copied ${tabs.length} URLs to clipboard`);
    } else {
      console.log('No URLs found to copy');
    }
  } catch (error) {
    console.error('Error copying URLs to clipboard:', error);
    throw error;
  }
}
