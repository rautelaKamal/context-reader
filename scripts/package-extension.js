import fs from 'fs';
import path from 'path';
import archiver from 'archiver';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function packageExtension() {
  try {
    // Create public directory if it doesn't exist
    const publicDir = path.join(__dirname, '..', 'public');
    if (!fs.existsSync(publicDir)) {
      console.log('Creating public directory...');
      fs.mkdirSync(publicDir);
    }

    // Check if extension directory exists
    const extensionDir = path.join(__dirname, '..', 'src', 'extension');
    if (!fs.existsSync(extensionDir)) {
      throw new Error('Extension directory not found at: ' + extensionDir);
    }

    // Create a write stream to save the zip file
    const output = fs.createWriteStream(path.join(publicDir, 'extension.zip'));
    const archive = archiver('zip', {
      zlib: { level: 9 } // Maximum compression
    });

    // Listen for all archive data to be written
    output.on('close', function() {
      console.log(' Extension packaged successfully!');
      console.log(` Total bytes: ${archive.pointer()}`);
      console.log(` Location: ${path.join(publicDir, 'extension.zip')}`);
    });

    // Listen for warnings (e.g. stat failures and other non-blocking errors)
    archive.on('warning', function(err) {
      if (err.code === 'ENOENT') {
        console.warn(' Warning:', err);
      } else {
        throw err;
      }
    });

    // Listen for errors
    archive.on('error', function(err) {
      throw err;
    });

    // Pipe archive data to the file
    archive.pipe(output);

    // Create a temporary directory for the extension files
    const tempDir = path.join(__dirname, '..', 'temp-extension');
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    fs.mkdirSync(tempDir);

    // Copy all extension files to the temp directory
    console.log(' Copying extension files...');
    const files = fs.readdirSync(extensionDir);
    files.forEach(file => {
      const srcPath = path.join(extensionDir, file);
      const destPath = path.join(tempDir, file);
      fs.copyFileSync(srcPath, destPath);
    });

    // Copy the icon from public directory if it exists
    const iconSrc = path.join(__dirname, '..', 'public', 'icon.png');
    const iconDest = path.join(tempDir, 'icon.png');
    if (fs.existsSync(iconSrc)) {
      fs.copyFileSync(iconSrc, iconDest);
    } else {
      console.warn(' Warning: icon.png not found in public directory');
    }

    // Create manifest.json in the temp directory
    const manifest = {
      "manifest_version": 3,
      "name": "ContextReader",
      "version": "1.0",
      "description": "Get instant AI-powered explanations and translations for any text you're reading online",
      "permissions": ["activeTab", "storage"],
      "host_permissions": [
        "https://context-reader.vercel.app/*",
        "http://localhost:3000/*"
      ],
      "content_scripts": [
        {
          "matches": ["<all_urls>"],
          "js": ["content.js"],
          "css": ["content.css"]
        }
      ],
      "background": {
        "service_worker": "background.js"
      },
      "action": {
        "default_popup": "popup.html",
        "default_icon": {
          "16": "icon.png",
          "48": "icon.png",
          "128": "icon.png"
        }
      }
    };
    fs.writeFileSync(path.join(tempDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

    // Add the temp directory to the archive
    console.log(' Adding extension files to archive...');
    archive.directory(tempDir, false);

    // Finalize the archive
    console.log(' Finalizing package...');
    await archive.finalize();

  } catch (error) {
    console.error(' Error packaging extension:', error);
    process.exit(1);
  }
}

// Run the packaging function
packageExtension();
