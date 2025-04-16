// Background script for ContextReader extension
const manifest = chrome?.runtime?.getManifest();
const isDev = manifest?.development === true;
const API_BASE_URL = isDev
  ? 'http://localhost:3000'
  : 'https://context-reader.onrender.com';
console.log('ContextReader background: Using API base URL:', API_BASE_URL, '(isDev:', isDev, ')');


chrome.runtime.onInstalled.addListener(() => {
  console.log('ContextReader extension installed');
});

// Handle messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'translate' || request.type === 'explain') {
    handleAPIRequest(request, sendResponse);
    return true; // Will respond asynchronously
  }
});

async function handleAPIRequest(request, sendResponse) {
  console.log('ContextReader background: Handling API request:', request);
  try {
    const endpoint = request.type === 'translate' ? '/api/translate' : '/api/explain';
    const url = `${API_BASE_URL}${endpoint}`;
    console.log('ContextReader background: Making request to:', url);
    
    // Log the full request details
    const requestBody = {
      text: request.text,
      url: request.url
    };
    console.log('ContextReader background: Request body:', requestBody);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Origin': chrome.runtime.getURL('')
      },
      body: JSON.stringify(requestBody)
    });

    console.log('ContextReader background: Response status:', response.status);
    console.log('ContextReader background: Response headers:', [...response.headers.entries()]);

    if (!response.ok) {
      let errorMessage;
      try {
        const errorData = await response.json();
        errorMessage = errorData.error;
      } catch {
        errorMessage = `HTTP error! status: ${response.status}`;
      }
      throw new Error(errorMessage);
    }

    const data = await response.json();
    console.log('ContextReader background: Received data:', data);
    sendResponse({ success: true, data });
  } catch (error) {
    console.error('ContextReader background: API request error:', error);
    console.error('ContextReader background: Error stack:', error.stack);
    let errorMessage = 'An unexpected error occurred. Please try again.';

    if (error.message.includes('API configuration error')) {
      errorMessage = 'Service is temporarily unavailable. Please try again later.';
    } else if (error.message.includes('Too many requests')) {
      errorMessage = 'Too many requests. Please wait a moment and try again.';
    } else if (error.message.includes('Text is too long')) {
      errorMessage = 'Selected text is too long. Please select a shorter passage.';
    } else if (!navigator.onLine) {
      errorMessage = 'No internet connection. Please check your network and try again.';
    }

    sendResponse({ success: false, error: errorMessage });
  }
}
