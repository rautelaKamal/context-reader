# ContextReader

A powerful browser extension that provides AI-powered explanations and translations for any text you're reading online.

## Features

- **Instant Explanations**: Select any text on a webpage to get an AI-powered explanation that appears right next to your selection
- **Simple Translations**: Translate selected text with a single click
- **Contextual Understanding**: The AI provides deep contextual meaning and uses simple English
- **Non-intrusive UI**: The extension only appears when you need it and stays out of your way
- **Easy to Use**: Just select text and the explanation panel appears automatically

## Project Structure

- `/extension` - Browser extension source code
- `/public` - Static assets and packaged extension
- `/pages/api` - API routes for the explanation and translation services
- `/scripts` - Utility scripts for packaging the extension

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Run the development server:
   ```bash
   npm run dev
   ```

3. Package the extension:
   ```bash
   npm run package-extension
   ```

4. Install the extension in Chrome:
   - Go to `chrome://extensions/`
   - Enable Developer Mode
   - Click "Load unpacked"
   - Select the `extension` folder or use the packaged zip from `public/extension.zip`

3. Build the browser extension:
   ```bash
   npm run build:extension
   ```

## Technologies

- Next.js 14 with TypeScript
- TailwindCSS for styling
- Browser Extensions API
- AI-powered text analysis
- Authentication system

## License

MIT
