// Homepage component

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl md:text-6xl">
            <span className="block">Understand Everything You Read</span>
            <span className="block text-blue-600">with ContextReader</span>
          </h1>
          <p className="mt-3 max-w-md mx-auto text-base text-gray-500 sm:text-lg md:mt-5 md:text-xl md:max-w-3xl">
            Get instant AI-powered explanations, translations, and contextual insights for any text you&apos;re reading online.
          </p>
          <div className="mt-5 max-w-md mx-auto sm:flex sm:justify-center md:mt-8">
            <div className="rounded-md shadow">
              <a
                href="/api/extension"
                className="w-full flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 md:py-4 md:text-lg md:px-10"
                download="context-reader-extension.zip"
              >
                Download Extension
              </a>
            </div>
            <div className="mt-3 rounded-md shadow sm:mt-0 sm:ml-3">
              <a
                href="https://github.com/rautelaKamal/context-reader"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-blue-600 bg-white hover:bg-gray-50 md:py-4 md:text-lg md:px-10"
              >
                View Source
              </a>
            </div>
          </div>
        </div>

        <div className="mt-20">
          <h2 className="text-center text-3xl font-extrabold text-gray-900">
            Key Features
          </h2>
          <div className="mt-10">
            <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {[
                {
                  title: 'Smart Highlighting',
                  description: 'Select any text on any webpage to get instant explanations'
                },
                {
                  title: 'AI-Powered Insights',
                  description: 'Get contextual explanations powered by advanced AI'
                },
                {
                  title: 'Translation Support',
                  description: 'Instantly translate selected text to your preferred language'
                },
                {
                  title: 'Save & Sync',
                  description: 'Access your saved annotations across all your devices'
                },
                {
                  title: 'PDF Support',
                  description: 'Works seamlessly with PDF documents in your browser'
                },
                {
                  title: 'Privacy First',
                  description: 'Your data is encrypted and secure'
                }
              ].map((feature) => (
                <div key={feature.title} className="pt-6">
                  <div className="flow-root bg-gray-50 rounded-lg px-6 pb-8">
                    <div className="-mt-6">
                      <h3 className="mt-8 text-lg font-medium text-gray-900 tracking-tight">
                        {feature.title}
                      </h3>
                      <p className="mt-5 text-base text-gray-500">
                        {feature.description}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
