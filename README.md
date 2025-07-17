# chrome-tab-ex

This is a Chrome extension that sorts and groups tabs.

# Features

- Sort tabs by URL
- Group tabs by domain
- Group tabs by domain ignore sub-domain
- Ungroup all tab-groups
- Remove duplicated tabs
- Merge all browser windows into the current window

# Development

## Prerequisites

Before you can build and develop this Chrome extension, make sure you have the following installed:

- **Node.js** (version 14 or higher)
- **npm** (comes with Node.js)
- **Git** (for cloning the repository)

## Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/michimani/chrome-tab-ex.git
cd chrome-tab-ex
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Build the Extension

#### Production Build

To create a production-ready build:

```bash
npm run build
```

This will:

- Compile TypeScript files from `src/` to JavaScript
- Bundle the code using Webpack
- Copy static files from `public/` to `dist/`
- Create a `dist/` directory with the complete extension

#### Development Build (Watch Mode)

For development with automatic rebuilding on file changes:

```bash
npm run watch
```

This will continuously watch for changes in your source files and rebuild automatically.

### 4. Load the Extension in Chrome

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in the top-right corner)
3. Click "Load unpacked"
4. Select the `dist/` folder from your project directory
5. The extension should now appear in your extensions list

### 5. Development Workflow

1. Make changes to the source files in `src/`
2. If using watch mode (`npm run watch`), changes will be automatically compiled
3. If not using watch mode, run `npm run build` after making changes
4. Refresh the extension in Chrome:
   - Go to `chrome://extensions/`
   - Find your extension and click the refresh icon
   - Or use the keyboard shortcut `Ctrl+R` (Windows/Linux) or `Cmd+R` (Mac) while on the extensions page

## Project Structure

```
chrome-tab-ex/
├── src/                    # TypeScript source files
│   ├── groupTabs.ts       # Main extension logic
│   ├── chromeTabGroups.ts # Tab grouping functionality
│   ├── chromeTabs.ts      # Tab and window management utilities
│   ├── tld.ts            # Top-level domain utilities
│   └── url.ts            # URL parsing utilities
├── public/                # Static files
│   ├── manifest.json     # Extension manifest
│   ├── menu.html         # Popup HTML
│   ├── css/              # Stylesheets
│   └── images/           # Extension icons
├── dist/                 # Built extension (generated)
├── webpack/              # Webpack configuration
└── package.json          # Dependencies and scripts
```

## Available Scripts

- `npm run build` - Build the extension for production
- `npm run watch` - Build in watch mode for development
- `npm run clean` - Remove the `dist/` directory
- `npm run test` - Run Jest tests
- `npm run style` - Format TypeScript files with Prettier

## Testing

Run the test suite:

```bash
npm test
```

Tests are located alongside source files with `.test.ts` extensions.

## Code Formatting

Format your code with Prettier:

```bash
npm run style
```

## Building for Distribution

1. Run the production build:

   ```bash
   npm run clean && npm run build
   ```

2. The `dist/` folder contains the complete extension ready for:
   - Loading as an unpacked extension in Chrome
   - Packaging as a `.zip` file for Chrome Web Store submission

## Troubleshooting

### Common Issues

1. **Build fails with TypeScript errors**

   - Check that all dependencies are installed: `npm install`
   - Ensure TypeScript files have correct syntax and types

2. **Extension doesn't work after loading**

   - Check the browser console for JavaScript errors
   - Verify that `manifest.json` has correct permissions
   - Make sure the build completed successfully

3. **Changes not reflected in Chrome**
   - Refresh the extension in `chrome://extensions/`
   - Clear browser cache if necessary
   - Restart Chrome if issues persist

### Clean Reinstall

If you encounter persistent issues:

```bash
npm run clean
rm -rf node_modules/
npm install
npm run build
```

# Usage

Install this extension from Chrome Web Store.

[Group Tabs - Chrome Web Store](https://chrome.google.com/webstore/detail/group-tabs/cnmcnafaccboidemenkpfnlgfcejijgm/)
