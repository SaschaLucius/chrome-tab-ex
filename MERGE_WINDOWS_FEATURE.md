# Merge Windows Feature

## Overview

The Chrome Tab Extension now includes a new "Merge All Windows" feature that allows users to consolidate all browser tabs from multiple Chrome windows into a single window.

## How It Works

### Functionality

- **Merge All Windows**: Moves all tabs from other Chrome windows into the current window
- **Smart Handling**: Only moves non-pinned tabs to preserve pinned tab organization
- **Auto-Cleanup**: Automatically closes empty windows after moving tabs
- **Error Handling**: Gracefully handles any windows that can't be closed

### User Interface

- Added a new "Merge All Windows" button to the extension popup
- Button appears at the bottom of the action list
- Clicking the button immediately starts the merge process
- The popup automatically closes after a successful merge

### Implementation Details

#### New Functions in `chromeTabs.ts`:

- `getAllWindows()`: Gets all normal browser windows
- `getCurrentWindow()`: Gets the current active window
- `moveTabsToWindow()`: Moves specified tabs to a target window
- `closeWindow()`: Closes a specified window
- `mergeAllWindows()`: Main function that orchestrates the merge process

#### Process Flow:

1. Get the current window and all other windows
2. Collect all non-pinned tab IDs from other windows
3. Move all collected tabs to the current window
4. Close the now-empty windows
5. Log the results

#### Safety Features:

- Only moves non-pinned tabs to preserve user's pinned tab setup
- Handles errors gracefully if individual windows fail to close
- Validates window and tab IDs before operations
- Provides console logging for debugging

## Usage Instructions

1. **Install/Update**: Load the updated extension in Chrome
2. **Open Extension**: Click the extension icon in the toolbar
3. **Merge Windows**: Click "Merge All Windows" button
4. **Result**: All tabs from other windows will be moved to the current window

## Benefits

- **Organization**: Consolidate scattered tabs into a single window
- **Efficiency**: Reduce window management overhead
- **Integration**: Works seamlessly with existing tab grouping features
- **Performance**: Can help reduce Chrome's memory usage by eliminating extra windows

## Compatibility

- Compatible with existing extension features
- Works with tab groups (tabs maintain their group assignments)
- Respects pinned tabs (leaves them in their original windows)
- Supports Chrome's window management permissions

## Technical Notes

- Requires existing `tabs` permission in manifest.json
- Uses Chrome's Windows API for window management
- Implements proper async/await patterns for reliability
- Includes TypeScript type safety for all Chrome API calls
