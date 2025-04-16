'use client';

import { useEffect, useState } from 'react';

export default function TestPage() {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return <div>Loading...</div>;
  }

  return (
    <main className="min-h-screen bg-white p-8">
      <h1 className="text-3xl font-bold mb-6">Test the ContextReader Extension</h1>
      
      <div className="space-y-8">
        <section className="p-4 bg-gray-50 rounded-lg">
          <h2 className="text-xl font-semibold mb-4">Try Explanation</h2>
          <p className="text-gray-700">
            Select this text to test the explanation feature: The quantum computer uses qubits instead of traditional bits, 
            allowing it to perform complex calculations exponentially faster than classical computers.
          </p>
        </section>

        <section className="p-4 bg-gray-50 rounded-lg">
          <h2 className="text-xl font-semibold mb-4">Try Translation</h2>
          <p className="text-gray-700">
            Select this French text to test the translation feature: Le chat est sur la table et le chien dort dans le jardin.
          </p>
        </section>

        <section className="p-4 bg-gray-50 rounded-lg">
          <h2 className="text-xl font-semibold mb-4">Instructions</h2>
          <ol className="list-decimal list-inside space-y-2 text-gray-700">
            <li>Select any text on this page by clicking and dragging</li>
            <li>A popup should appear near your selection</li>
            <li>Click &quot;Explain&quot; for explanations or &quot;Translate&quot; for translations</li>
            <li>The result will appear in the popup</li>
            <li>Click anywhere outside the popup to dismiss it</li>
          </ol>
        </section>
      </div>
    </main>
  );
}
