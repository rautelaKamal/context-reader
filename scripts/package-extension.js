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

    // Add the extension directory to the archive
    console.log(' Adding extension files...');
    archive.directory(extensionDir, false);

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
