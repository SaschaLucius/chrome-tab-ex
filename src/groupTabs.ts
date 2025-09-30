import * as url from "./url";
import * as ct from "./chromeTabs";
import * as ctg from "./chromeTabGroups";

function groupTabs() {
  const sortTabs = <HTMLElement>document.getElementById("sortTabs");
  const sortTabsByLastAccessed = <HTMLElement>(
    document.getElementById("sortTabsByLastAccessed")
  );
  const groupTabs = <HTMLElement>document.getElementById("groupTabs");
  const groupTabsIgnoreSubDomain = <HTMLElement>(
    document.getElementById("groupTabsIgnoreSubDomain")
  );
  const groupTabsByLastAccessed = <HTMLElement>(
    document.getElementById("groupTabsByLastAccessed")
  );
  const ungroupTabs = <HTMLElement>document.getElementById("ungroupTabs");
  const removeDupTabs = <HTMLElement>document.getElementById("removeDupTabs");
  const removeDupTabsIgnoreParams = <HTMLElement>(
    document.getElementById("removeDupTabsIgnoreParams")
  );
  const copyAllUrls = <HTMLElement>document.getElementById("copyAllUrls");
  const closeCurrentTab = <HTMLElement>(
    document.getElementById("closeCurrentTab")
  );
  const moveCurrentTabToNewWindow = <HTMLElement>(
    document.getElementById("moveCurrentTabToNewWindow")
  );
  const mergeWindows = <HTMLElement>document.getElementById("mergeWindows");
  const canvasPiP = <HTMLElement>document.getElementById("canvasPiP");
  const interactivePiP = <HTMLElement>document.getElementById("interactivePiP");
  const elementPiP = <HTMLElement>document.getElementById("elementPiP");
  const restoreLastClosedTabs = <HTMLElement>(
    document.getElementById("restoreLastClosedTabs")
  );
  const targetTabConditions: chrome.tabs.QueryInfo = {
    currentWindow: true,
    pinned: false,
    url: ["http://*/*", "https://*/*"],
    groupId: chrome.tabGroups.TAB_GROUP_ID_NONE,
  };

  /**
   * action for "Sort Tabs (not to group)"
   */
  sortTabs.addEventListener("click", async () => {
    sortTabsByURL();
  });

  /**
   * action for "Sort Tabs by Last Accessed"
   */
  sortTabsByLastAccessed.addEventListener("click", async () => {
    sortTabsByLastAccessedTime();
  });

  /**
   * action for "Group Tabs by Domain"
   */
  groupTabs.addEventListener("click", async () => {
    sortTabsByDomainName();
    const tabs = await ct.queryTabs(targetTabConditions);
    const [activeTab] = await ct.getActiveTab();
    const pinnedTabs = await ct.getPinnedTabs();
    const domainMap: { [key: string]: number[] } = {};
    const domains: string[] = [];
    for (let i = 0; i < tabs.length; i++) {
      const domain = url.getDomainName(<string>tabs[i].url);
      if (domain === "") continue;
      if (!domainMap[domain]) {
        domainMap[domain] = [];
        domains.push(domain);
      }
      domainMap[domain].push(<number>tabs[i].id);
    }
    runGroupTabs(domains, domainMap, pinnedTabs, activeTab);
  });

  /**
   * action for "Group Tabs by Domain (ignore sub-domain)"
   */
  groupTabsIgnoreSubDomain.addEventListener("click", async () => {
    sortTabsByDomainNameIgnoreSubDomain();
    const tabs = await ct.queryTabs(targetTabConditions);
    const [activeTab] = await ct.getActiveTab();
    const pinnedTabs = await ct.getPinnedTabs();
    const domainMap: { [key: string]: number[] } = {};
    const domains: string[] = [];
    for (let i = 0; i < tabs.length; i++) {
      const domain = url.getDomainNameIgnoreSubDomain(<string>tabs[i].url);
      if (domain === "") continue;
      if (!domainMap[domain]) {
        domainMap[domain] = [];
        domains.push(domain);
      }
      domainMap[domain].push(<number>tabs[i].id);
    }
    runGroupTabs(domains, domainMap, pinnedTabs, activeTab);
  });

  /**
   * action for "Group Tabs by Last Accessed"
   */
  groupTabsByLastAccessed.addEventListener("click", async () => {
    await groupTabsByLastAccessedTime();
  });

  /**
   * action for "Ungroup"
   */
  ungroupTabs.addEventListener("click", async () => {
    const tabs = await ct.queryTabs({
      currentWindow: true,
      pinned: false,
      url: ["http://*/*", "https://*/*"],
    });
    const tabIDs: number[] = [];
    for (let i = 0; i < tabs.length; i++) {
      if (tabs[i].groupId === undefined) continue;
      tabIDs.push(<number>tabs[i].id);
    }
    ct.ungroupTabs(tabIDs);
  });

  /**
   * action for "Remove duplicated tabs"
   */
  removeDupTabs.addEventListener("click", async () => {
    removeDuplicatedTabs();
  });

  /**
   * action for "Remove duplicated tabs (ignore URL parameters)"
   */
  removeDupTabsIgnoreParams.addEventListener("click", async () => {
    removeDuplicatedTabsIgnoreParams();
  });

  /**
   * action for "Merge All Windows"
   */
  mergeWindows.addEventListener("click", async () => {
    try {
      await ct.mergeAllWindows();
      window.close();
    } catch (error) {
      console.error("Error merging windows:", error);
    }
  });

  /**
   * action for "Canvas PiP Overlay" (uses content script)
   */
  canvasPiP.addEventListener("click", async () => {
    try {
      const [activeTab] = await ct.getActiveTab();
      if (!activeTab || activeTab.id == null) return;
      const tabId = activeTab.id;
      const response = await new Promise<any>((resolve) => {
        let done = false;
        const timeout = setTimeout(() => {
          if (done) return;
          done = true;
          resolve({ ok: false, reason: "timeout-waiting-response" });
        }, 4000);
        chrome.tabs.sendMessage(tabId, { type: "START_CANVAS_PIP" }, (resp) => {
          if (done) return;
          done = true;
          clearTimeout(timeout);
          if (chrome.runtime.lastError) {
            const msg = chrome.runtime.lastError.message || "";
            if (
              msg.includes("Could not establish connection") ||
              msg.includes("Receiving end does not exist")
            ) {
              // Attempt to inject content script dynamically then retry once
              (async () => {
                try {
                  await chrome.scripting.executeScript({
                    target: { tabId },
                    files: ["js/canvasPiPContent.js"],
                  });
                  setTimeout(() => {
                    chrome.tabs.sendMessage(
                      tabId,
                      { type: "START_CANVAS_PIP" },
                      (second) => {
                        if (chrome.runtime.lastError) {
                          resolve({
                            ok: false,
                            reason:
                              "inject-retry-error:" +
                              chrome.runtime.lastError.message,
                          });
                        } else {
                          resolve(
                            second || {
                              ok: false,
                              reason: "no-response-after-inject",
                            }
                          );
                        }
                      }
                    );
                  }, 120);
                } catch (injErr) {
                  resolve({
                    ok: false,
                    reason: "inject-failed:" + (injErr as Error).message,
                  });
                }
              })();
              return;
            }
            resolve({
              ok: false,
              reason: "sendMessage-error:" + msg,
            });
            return;
          }
          resolve(resp);
        });
      });
      if (!response || !response.ok) {
        chrome.notifications.create({
          type: "basic",
          iconUrl: "/images/gt_icon48.png",
          title: "Canvas PiP failed",
          message: (response && response.reason) || "unknown",
        });
      } else {
        chrome.notifications.create({
          type: "basic",
          iconUrl: "/images/gt_icon48.png",
          title: "Canvas PiP",
          message: "Started Picture-in-Picture",
        });
        window.close();
      }
    } catch (error) {
      console.error("Error starting canvas PiP:", error);
      chrome.notifications.create({
        type: "basic",
        iconUrl: "/images/gt_icon48.png",
        title: "Canvas PiP error",
        message: (error as Error).message || "Unknown error",
      });
    }
  });

  /**
   * action for "Interactive PiP (Document PiP)"
   */
  interactivePiP.addEventListener("click", async () => {
    try {
      const [activeTab] = await ct.getActiveTab();
      if (!activeTab || activeTab.id == null) return;
      const tabId = activeTab.id;
      const response = await new Promise<any>((resolve) => {
        let done = false;
        const timeout = setTimeout(() => {
          if (done) return;
          done = true;
          resolve({ ok: false, reason: "timeout-waiting-response" });
        }, 4000);
        chrome.tabs.sendMessage(
          tabId,
          { type: "START_INTERACTIVE_PIP" },
          (resp) => {
            if (done) return;
            done = true;
            clearTimeout(timeout);
            if (chrome.runtime.lastError) {
              const msg = chrome.runtime.lastError.message || "";
              if (
                msg.includes("Could not establish connection") ||
                msg.includes("Receiving end does not exist")
              ) {
                (async () => {
                  try {
                    await chrome.scripting.executeScript({
                      target: { tabId },
                      files: ["js/canvasPiPContent.js"],
                    });
                    setTimeout(() => {
                      chrome.tabs.sendMessage(
                        tabId,
                        { type: "START_INTERACTIVE_PIP" },
                        (second) => {
                          if (chrome.runtime.lastError) {
                            resolve({
                              ok: false,
                              reason:
                                "inject-retry-error:" +
                                chrome.runtime.lastError.message,
                            });
                          } else {
                            resolve(
                              second || {
                                ok: false,
                                reason: "no-response-after-inject",
                              }
                            );
                          }
                        }
                      );
                    }, 120);
                  } catch (injErr) {
                    resolve({
                      ok: false,
                      reason: "inject-failed:" + (injErr as Error).message,
                    });
                  }
                })();
                return;
              }
              resolve({ ok: false, reason: "sendMessage-error:" + msg });
              return;
            }
            resolve(resp);
          }
        );
      });
      if (!response || !response.ok) {
        chrome.notifications.create({
          type: "basic",
          iconUrl: "/images/gt_icon48.png",
          title: "Interactive PiP failed",
          message: (response && response.reason) || "unknown",
        });
      } else {
        chrome.notifications.create({
          type: "basic",
          iconUrl: "/images/gt_icon48.png",
          title: "Interactive PiP",
          message: "Started interactive PiP",
        });
        window.close();
      }
    } catch (error) {
      console.error("Error starting interactive PiP:", error);
      chrome.notifications.create({
        type: "basic",
        iconUrl: "/images/gt_icon48.png",
        title: "Interactive PiP error",
        message: (error as Error).message || "Unknown error",
      });
    }
  });

  /**
   * action for "Select Element PiP"
   */
  elementPiP.addEventListener("click", async () => {
    try {
      const [activeTab] = await ct.getActiveTab();
      if (!activeTab || activeTab.id == null) return;
      const tabId = activeTab.id;
      const response = await new Promise<any>((resolve) => {
        let done = false;
        const timeout = setTimeout(() => {
          if (done) return;
          done = true;
          resolve({ ok: false, reason: "timeout-waiting-response" });
        }, 4000);
        chrome.tabs.sendMessage(
          tabId,
          { type: "START_ELEMENT_PIP" },
          (resp) => {
            if (done) return;
            done = true;
            clearTimeout(timeout);
            if (chrome.runtime.lastError) {
              const msg = chrome.runtime.lastError.message || "";
              if (
                msg.includes("Could not establish connection") ||
                msg.includes("Receiving end does not exist")
              ) {
                (async () => {
                  try {
                    await chrome.scripting.executeScript({
                      target: { tabId },
                      files: ["js/elementPiPContent.js"],
                    });
                    setTimeout(() => {
                      chrome.tabs.sendMessage(
                        tabId,
                        { type: "START_ELEMENT_PIP" },
                        (second) => {
                          if (chrome.runtime.lastError) {
                            resolve({
                              ok: false,
                              reason:
                                "inject-retry-error:" +
                                chrome.runtime.lastError.message,
                            });
                          } else {
                            resolve(
                              second || {
                                ok: false,
                                reason: "no-response-after-inject",
                              }
                            );
                          }
                        }
                      );
                    }, 120);
                  } catch (injErr) {
                    resolve({
                      ok: false,
                      reason: "inject-failed:" + (injErr as Error).message,
                    });
                  }
                })();
                return;
              }
              resolve({ ok: false, reason: "sendMessage-error:" + msg });
              return;
            }
            resolve(resp);
          }
        );
      });
      if (!response || !response.ok) {
        chrome.notifications.create({
          type: "basic",
          iconUrl: "/images/gt_icon48.png",
          title: "Element PiP failed",
          message: (response && response.reason) || "unknown",
        });
      } else {
        chrome.notifications.create({
          type: "basic",
          iconUrl: "/images/gt_icon48.png",
          title: "Element PiP",
          message: "Select element highlighted; click to open PiP",
        });
        window.close();
      }
    } catch (error) {
      console.error("Error starting element PiP:", error);
      chrome.notifications.create({
        type: "basic",
        iconUrl: "/images/gt_icon48.png",
        title: "Element PiP error",
        message: (error as Error).message || "Unknown error",
      });
    }
  });

  /**
   * action for "Copy All URLs to Clipboard"
   */
  copyAllUrls.addEventListener("click", async () => {
    try {
      await ct.copyAllUrlsToClipboard();
      // Close the popup after successful copy
      window.close();
    } catch (error) {
      console.error("Error copying URLs to clipboard:", error);
    }
  });

  /**
   * action for "Close Selected Tabs"
   */
  closeCurrentTab.addEventListener("click", async () => {
    try {
      await ct.closeSelectedTabs();
      // The popup will automatically close when the tab closes
    } catch (error) {
      console.error("Error closing selected tabs:", error);
    }
  });

  /**
   * action for "Move Selected Tabs to New Window"
   */
  moveCurrentTabToNewWindow.addEventListener("click", async () => {
    try {
      await ct.moveSelectedTabsToNewWindow();
      // Close the popup after successful move
      window.close();
    } catch (error) {
      console.error("Error moving selected tabs to new window:", error);
    }
  });

  /**
   * action for "Restore Last Closed Tabs"
   */
  restoreLastClosedTabs.addEventListener("click", async () => {
    try {
      const restoredCount = await ct.restoreLastClosedTabs();
      if (restoredCount > 0) {
        // Show notification about restored tabs
        chrome.notifications.create({
          type: "basic",
          iconUrl: "/images/gt_icon48.png",
          title: "Group Tabs",
          message: `Restored ${restoredCount} tab${
            restoredCount === 1 ? "" : "s"
          }`,
        });
        // Close the popup after successful restore
        window.close();
      } else {
        // Show notification that no tabs were available to restore
        chrome.notifications.create({
          type: "basic",
          iconUrl: "/images/gt_icon48.png",
          title: "Group Tabs",
          message: "No closed tabs to restore",
        });
      }
    } catch (error) {
      console.error("Error restoring closed tabs:", error);
    }
  });

  const sortTabsByURL = async () => {
    const tabs = await ct.queryTabs(targetTabConditions);
    const sorted = ct.sortTabsByURL(tabs);
    ct.moveTabs(sorted);
  };

  const sortTabsByDomainName = async () => {
    const tabs = await ct.queryTabs(targetTabConditions);
    const sorted = ct.sortTabsByDomainName(tabs);
    ct.moveTabs(sorted);
  };

  const sortTabsByDomainNameIgnoreSubDomain = async () => {
    const tabs = await ct.queryTabs(targetTabConditions);
    const sorted = ct.sortTabsByDomainNameIgnoreSubDomain(tabs);
    ct.moveTabs(sorted);
  };

  const runGroupTabs = async (
    domains: string[],
    domainMap: { [key: string]: number[] },
    pinnedTabs: chrome.tabs.Tab[],
    activeTab: chrome.tabs.Tab
  ) => {
    domains.sort((a, b) => {
      return a < b ? 1 : -1;
    });

    let groupedCnt = 0;
    for (let i = 0; i < domains.length; i++) {
      const d: string = domains[i];

      // not group for domain has one tab
      if (domainMap[d].length == 1) {
        continue;
      }

      const groupID: number = await ct.groupTabs(domainMap[d]);
      const collapsed: boolean = !domainMap[d].includes(<number>activeTab.id);
      const colorIdx = groupedCnt % ctg.groupColors.length;
      ctg.updateTabGroup(groupID, {
        collapsed: collapsed,
        title: d,
        color: ctg.groupColors[colorIdx],
      });
      ctg.moveGroup(groupID, pinnedTabs.length);
      groupedCnt++;
    }
  };

  const sortTabsByLastAccessedTime = async () => {
    try {
      const tabs = await ct.queryTabs(targetTabConditions);
      const tabActivityData = await ct.getTabActivityData();
      const sorted = ct.sortTabsByLastAccessed(tabs, tabActivityData);
      ct.moveTabs(sorted);
    } catch (error) {
      console.error("Error sorting tabs by last accessed:", error);
    }
  };

  const groupTabsByLastAccessedTime = async () => {
    try {
      console.log("Starting groupTabsByLastAccessedTime...");
      const tabs = await ct.queryTabs(targetTabConditions);
      const [activeTab] = await ct.getActiveTab();
      const pinnedTabs = await ct.getPinnedTabs();
      const tabActivityData = await ct.getTabActivityData();

      console.log("Tabs found:", tabs.length);
      console.log("Tab activity data:", tabActivityData);

      // Sort tabs by last accessed first
      const sortedTabs = ct.sortTabsByLastAccessed(tabs, tabActivityData);

      // Create time-based groups (e.g., "Recently Accessed", "1 Hour Ago", etc.)
      const timeGroups: { [key: string]: number[] } = {};
      const groupNames: string[] = [];

      sortedTabs.forEach((tab) => {
        if (!tab.id) return;
        const now = new Date();

        const lastAccessed = tabActivityData[tab.id.toString()] || 0;

        let groupName: string;

        // If no activity data, treat as very old
        if (lastAccessed === 0) {
          groupName = "Older";
        } else {
          const timeDiff = now.getTime() - lastAccessed;
          const tabDate = new Date(lastAccessed);

          if (timeDiff < 60 * 1000) {
            // < 1 minute
            groupName = "Last Minute";
          } else if (timeDiff < 5 * 60 * 1000) {
            // < 5 minutes
            groupName = "Last 5 Minutes";
          } else if (timeDiff < 30 * 60 * 1000) {
            // < 30 minutes
            groupName = "Last 30 Minutes";
          } else if (timeDiff < 60 * 60 * 1000) {
            // < 1 hour
            groupName = "Last Hour";
          } else if (timeDiff < 12 * 60 * 60 * 1000) {
            // < 12 hours
            groupName = "Last Half Day";
          } else if (
            now.getDate() === tabDate.getDate() &&
            now.getMonth() === tabDate.getMonth() &&
            now.getFullYear() === tabDate.getFullYear()
          ) {
            groupName = "Today";
          } else {
            // Calculate days difference more reliably
            const nowDate = new Date(
              now.getFullYear(),
              now.getMonth(),
              now.getDate()
            );
            const tabDateOnly = new Date(
              tabDate.getFullYear(),
              tabDate.getMonth(),
              tabDate.getDate()
            );
            const daysDiff = Math.floor(
              (nowDate.getTime() - tabDateOnly.getTime()) /
                (24 * 60 * 60 * 1000)
            );

            if (daysDiff === 1) {
              groupName = "Yesterday";
            } else if (daysDiff <= 7) {
              groupName = "This Week";
            } else if (daysDiff <= 14) {
              groupName = "Last Week";
            } else if (
              now.getMonth() === tabDate.getMonth() &&
              now.getFullYear() === tabDate.getFullYear()
            ) {
              groupName = "This Month";
            } else if (
              (now.getMonth() === tabDate.getMonth() + 1 &&
                now.getFullYear() === tabDate.getFullYear()) ||
              (now.getMonth() === 0 &&
                tabDate.getMonth() === 11 &&
                now.getFullYear() === tabDate.getFullYear() + 1)
            ) {
              groupName = "Last Month";
            } else {
              groupName = "Older";
            }
          }
        }
        if (!timeGroups[groupName]) {
          timeGroups[groupName] = [];
          groupNames.push(groupName);
        }

        timeGroups[groupName].push(tab.id);
      });

      console.log("Time groups created:", timeGroups);

      // Group tabs by time ranges
      const groupOrder = [
        "Last Minute",
        "Last 5 Minutes",
        "Last 30 Minutes",
        "Last Hour",
        "Last Half Day",
        "Today",
        "Yesterday",
        "This Week",
        "Last Week",
        "This Month",
        "Last Month",
        "Older",
      ];

      let groupedCnt = 0;
      for (const groupName of groupOrder) {
        if (timeGroups[groupName] && timeGroups[groupName].length > 0) {
          console.log(
            `Processing group: ${groupName} with ${timeGroups[groupName].length} tabs`
          );

          // Create group even for single tabs
          const groupID: number = await ct.groupTabs(timeGroups[groupName]);
          const collapsed: boolean = !timeGroups[groupName].includes(
            <number>activeTab.id
          );
          const colorIdx = groupedCnt % ctg.groupColors.length;

          ctg.updateTabGroup(groupID, {
            collapsed: collapsed,
            title: groupName,
            color: ctg.groupColors[colorIdx],
          });
          ctg.moveGroup(groupID, pinnedTabs.length);
          groupedCnt++;
        }
      }

      // Move sorted tabs to maintain order
      ct.moveTabs(sortedTabs);
    } catch (error) {
      console.error("Error grouping tabs by last accessed:", error);
    }
  };

  /**
   * Show notification about duplicate tabs removal
   * @param closedCount Number of tabs that were closed
   * @param ignoreParams Whether URL parameters were ignored during deduplication
   */
  const showDuplicateTabsNotification = (
    closedCount: number,
    ignoreParams: boolean = false
  ) => {
    const paramsSuffix = ignoreParams ? " (ignoring URL parameters)" : "";

    if (closedCount > 0) {
      chrome.notifications.create({
        type: "basic",
        iconUrl: "/images/gt_icon48.png",
        title: "Group Tabs",
        message: `Closed ${closedCount} duplicate tab${
          closedCount === 1 ? "" : "s"
        }${paramsSuffix}`,
      });
    } else {
      chrome.notifications.create({
        type: "basic",
        iconUrl: "/images/gt_icon48.png",
        title: "Group Tabs",
        message: `No duplicate tabs found${paramsSuffix}`,
      });
    }
  };

  const removeDuplicatedTabs = async () => {
    const tabs = await ct.queryTabs({
      currentWindow: true,
      pinned: false,
      url: ["http://*/*", "https://*/*"],
    });
    const exists: { [key: string]: boolean } = {};
    const tabsToClose: chrome.tabs.Tab[] = [];

    for (let i = 0; i < tabs.length; i++) {
      if (tabs[i] === undefined) {
        continue;
      }
      const t = tabs[i];
      if (t.url === undefined) {
        continue;
      }
      if (exists[t.url] !== undefined) {
        if (t.id === undefined) {
          continue;
        }
        tabsToClose.push(t);
        continue;
      }
      exists[t.url] = true;
    }

    // Use the common close function with history tracking
    const closedCount = await ct.closeTabsWithHistory(
      tabsToClose,
      "removeDuplicates"
    );

    // Show notification with count
    showDuplicateTabsNotification(closedCount);
  };

  const removeDuplicatedTabsIgnoreParams = async () => {
    const tabs = await ct.queryTabs({
      currentWindow: true,
      pinned: false,
      url: ["http://*/*", "https://*/*"],
    });
    const exists: { [key: string]: boolean } = {};
    const tabsToClose: chrome.tabs.Tab[] = [];

    for (let i = 0; i < tabs.length; i++) {
      if (tabs[i] === undefined) {
        continue;
      }
      const t = tabs[i];
      if (t.url === undefined) {
        continue;
      }
      // Get URL without parameters to compare for duplicates
      const urlWithoutParams = url.getURLWithoutParameters(t.url);
      if (exists[urlWithoutParams] !== undefined) {
        if (t.id === undefined) {
          continue;
        }
        tabsToClose.push(t);
        continue;
      }
      exists[urlWithoutParams] = true;
    }

    // Use the common close function with history tracking
    const closedCount = await ct.closeTabsWithHistory(
      tabsToClose,
      "removeDuplicatesIgnoreParams"
    );

    // Show notification with count
    showDuplicateTabsNotification(closedCount, true);
  };
}

groupTabs();
