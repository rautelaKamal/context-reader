import Head from 'next/head';
import { useState, useEffect } from 'react';
import styles from '../styles/Home.module.css';

export default function Home() {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  return (
    <div className={styles.container}>
      <Head>
        <title>ContextReader - AI-Powered Text Explanations</title>
        <meta name="description" content="Get instant AI-powered explanations and translations for any text you're reading online" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className={styles.main}>
        <h1 className={styles.title}>
          Welcome to <span className={styles.highlight}>ContextReader</span>
        </h1>

        <p className={styles.description}>
          Get instant AI-powered explanations and translations for any text you're reading online
        </p>

        <div className={styles.grid}>
          <div className={styles.card}>
            <h2>How It Works</h2>
            <p>
              1. Select any text on a webpage<br />
              2. A panel appears next to your selection<br />
              3. Click "Explain" or "Translate"<br />
              4. Get instant AI-powered results
            </p>
          </div>

          <div className={styles.card}>
            <h2>Features</h2>
            <p>
              ✓ Instant explanations<br />
              ✓ Simple translations<br />
              ✓ Contextual understanding<br />
              ✓ Non-intrusive UI<br />
              ✓ Easy to use
            </p>
          </div>

          <div className={styles.downloadCard}>
            <h2>Download Extension</h2>
            <p>Install ContextReader in your browser:</p>
            {isClient && (
              <a href="/extension.zip" className={styles.button} download>
                Download Extension
              </a>
            )}
            <p className={styles.installInstructions}>
              After downloading:
              <ol>
                <li>Unzip the file</li>
                <li>Go to chrome://extensions/</li>
                <li>Enable Developer Mode</li>
                <li>Click "Load unpacked"</li>
                <li>Select the unzipped folder</li>
              </ol>
            </p>
          </div>
        </div>
      </main>

      <footer className={styles.footer}>
        <p>
          Powered by AI - Made with ❤️
        </p>
      </footer>
    </div>
  );
}
