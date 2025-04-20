// Content script for ContextReader extension
console.log('ContextReader: Content script loaded');

// Create a popup UI element that appears near the selected text
function createPopupUI(x, y, selectedText) {
  console.log('Creating popup UI element at', x, y);
  
  // Remove any existing popup
  removeExistingPopup();
  
  // Create the container
  const container = document.createElement('div');
  container.id = 'context-reader-container';
  container.style.position = 'absolute';
  container.style.left = `${x}px`;
  container.style.top = `${y}px`;
  container.style.width = '350px';
  container.style.backgroundColor = 'white';
  container.style.borderRadius = '12px';
  container.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.2)';
  container.style.padding = '20px';
  container.style.zIndex = '2147483647';
  container.style.fontFamily = 'Arial, sans-serif';
  container.style.border = '1px solid #e0e0e0';
  container.style.maxHeight = '400px';
  container.style.overflowY = 'auto';
  
  // Create the header container with title and close button
  const headerContainer = document.createElement('div');
  headerContainer.style.display = 'flex';
  headerContainer.style.justifyContent = 'space-between';
  headerContainer.style.alignItems = 'center';
  headerContainer.style.marginBottom = '15px';
  headerContainer.style.borderBottom = '1px solid #f0f0f0';
  headerContainer.style.paddingBottom = '10px';
  
  const header = document.createElement('h3');
  header.textContent = 'ContextReader';
  header.style.margin = '0';
  header.style.color = '#4285f4';
  header.style.fontSize = '18px';
  header.style.fontWeight = '600';
  
  const closeButton = document.createElement('button');
  closeButton.innerHTML = '&times;';
  closeButton.style.background = 'none';
  closeButton.style.border = 'none';
  closeButton.style.color = '#666';
  closeButton.style.fontSize = '20px';
  closeButton.style.cursor = 'pointer';
  closeButton.style.padding = '0 5px';
  closeButton.style.lineHeight = '1';
  closeButton.title = 'Minimize (click extension icon to show again)';
  
  headerContainer.appendChild(header);
  headerContainer.appendChild(closeButton);
  
  // Create the input field
  const input = document.createElement('textarea');
  input.id = 'context-reader-input';
  input.placeholder = 'Enter text to explain or translate';
  input.style.width = '100%';
  input.style.padding = '12px';
  input.style.marginBottom = '15px';
  input.style.borderRadius = '8px';
  input.style.border = '1px solid #e0e0e0';
  input.style.boxSizing = 'border-box';
  input.style.minHeight = '80px';
  input.style.fontSize = '14px';
  input.style.fontFamily = 'Arial, sans-serif';
  input.style.resize = 'vertical';
  
  // Create the buttons
  const buttonContainer = document.createElement('div');
  buttonContainer.style.display = 'flex';
  buttonContainer.style.gap = '12px';
  buttonContainer.style.marginBottom = '15px';
  
  const explainButton = document.createElement('button');
  explainButton.textContent = 'Explain';
  explainButton.style.backgroundColor = '#4285f4';
  explainButton.style.color = 'white';
  explainButton.style.border = 'none';
  explainButton.style.padding = '10px 20px';
  explainButton.style.borderRadius = '8px';
  explainButton.style.cursor = 'pointer';
  explainButton.style.flex = '1';
  explainButton.style.fontWeight = '500';
  explainButton.style.fontSize = '14px';
  explainButton.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1)';
  explainButton.style.transition = 'background-color 0.2s';
  
  const translateButton = document.createElement('button');
  translateButton.textContent = 'Translate';
  translateButton.style.backgroundColor = '#34a853';
  translateButton.style.color = 'white';
  translateButton.style.border = 'none';
  translateButton.style.padding = '10px 20px';
  translateButton.style.borderRadius = '8px';
  translateButton.style.cursor = 'pointer';
  translateButton.style.flex = '1';
  translateButton.style.fontWeight = '500';
  translateButton.style.fontSize = '14px';
  translateButton.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1)';
  translateButton.style.transition = 'background-color 0.2s';
  
  explainButton.addEventListener('mouseover', () => {
    explainButton.style.backgroundColor = '#3367d6';
  });
  
  explainButton.addEventListener('mouseout', () => {
    explainButton.style.backgroundColor = '#4285f4';
  });
  
  translateButton.addEventListener('mouseover', () => {
    translateButton.style.backgroundColor = '#2d9348';
  });
  
  translateButton.addEventListener('mouseout', () => {
    translateButton.style.backgroundColor = '#34a853';
  });
  
  // Create the result area
  const resultArea = document.createElement('div');
  resultArea.id = 'context-reader-result';
  resultArea.style.padding = '15px';
  resultArea.style.backgroundColor = '#f8f9fa';
  resultArea.style.borderRadius = '8px';
  resultArea.style.minHeight = '80px';
  resultArea.style.maxHeight = '250px';
  resultArea.style.overflowY = 'auto';
  resultArea.style.border = '1px solid #e0e0e0';
  resultArea.style.color = '#333';
  resultArea.style.fontSize = '14px';
  resultArea.style.lineHeight = '1.5';
  resultArea.style.fontFamily = 'Arial, sans-serif';
  resultArea.textContent = 'Results will appear here';
  
  // Add event listeners
  explainButton.addEventListener('click', () => {
    const text = input.value.trim();
    if (!text) {
      resultArea.textContent = 'Please enter some text to explain';
      return;
    }
    callExplainAPI(text, resultArea);
  });
  
  translateButton.addEventListener('click', () => {
    const text = input.value.trim();
    if (!text) {
      resultArea.textContent = 'Please enter some text to translate';
      return;
    }
    callTranslateAPI(text, resultArea);
  });
  
  // Assemble the UI
  buttonContainer.appendChild(explainButton);
  buttonContainer.appendChild(translateButton);
  
  container.appendChild(headerContainer);
  container.appendChild(input);
  container.appendChild(buttonContainer);
  container.appendChild(resultArea);
  
  // Add event listener for close button
  closeButton.addEventListener('click', () => {
    removeExistingPopup();
  });
  
  // Add to the page
  document.body.appendChild(container);
  console.log('Popup UI element created and added to DOM');
  
  // Automatically focus the input and set the selected text
  input.value = selectedText;
  input.focus();
  
  // Position the popup within viewport bounds
  ensureInViewport(container);
  
  return container;
}

// Function to ensure the popup stays within the viewport
function ensureInViewport(element) {
  const rect = element.getBoundingClientRect();
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
  
  // Check if the popup extends beyond the right edge of the viewport
  if (rect.right > viewportWidth) {
    const overflowX = rect.right - viewportWidth;
    element.style.left = `${parseInt(element.style.left) - overflowX - 20}px`;
  }
  
  // Check if the popup extends beyond the bottom edge of the viewport
  if (rect.bottom > viewportHeight) {
    const overflowY = rect.bottom - viewportHeight;
    element.style.top = `${parseInt(element.style.top) - overflowY - 20}px`;
  }
  
  // Make sure it's not positioned off the left or top edge
  if (rect.left < 0) {
    element.style.left = '20px';
  }
  
  if (rect.top < 0) {
    element.style.top = '20px';
  }
}

// Function to remove existing popup
function removeExistingPopup() {
  const existingPopup = document.getElementById('context-reader-container');
  if (existingPopup) {
    document.body.removeChild(existingPopup);
  }
}

// Text selection handler
document.addEventListener('mouseup', (event) => {
  const selection = window.getSelection();
  const selectedText = selection?.toString().trim();
  
  if (selectedText && selectedText.length > 3) { // Only show for selections longer than 3 characters
    // Get the coordinates of the selection
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    
    // Position the popup below the selection
    const x = rect.left + window.scrollX;
    const y = rect.bottom + window.scrollY + 10; // 10px below the selection
    
    // Create the popup
    createPopupUI(x, y, selectedText);
  } else if (!selectedText) {
    // Check if click is outside the popup
    const popup = document.getElementById('context-reader-container');
    if (popup && !popup.contains(event.target)) {
      removeExistingPopup();
    }
  }
});

// Function to call the explain API
async function callExplainAPI(text, resultElement) {
  console.log('Calling explain API for text:', text);
  resultElement.textContent = 'Loading explanation...';
  resultElement.style.color = '#666';
  resultElement.style.fontStyle = 'italic';
  
  fetch('https://context-reader.vercel.app/api/explain', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ 
      text, 
      options: {
        style: 'simple',
        contextDepth: 'deep',
        includeExamples: true
      }
    }),
  })
  .then(response => {
    console.log('Response status:', response.status);
    return response.json();
  })
  .then(data => {
    console.log('Response data:', data);
    if (data.explanation) {
      resultElement.textContent = data.explanation;
      resultElement.style.color = '#333';
      resultElement.style.fontStyle = 'normal';
    } else if (data.error) {
      resultElement.textContent = 'Error: ' + data.error;
      resultElement.style.color = '#d93025';
    } else {
      resultElement.textContent = 'Received response but no explanation found';
    }
  })
  .catch(error => {
    console.error('Error calling explain API:', error);
    resultElement.textContent = 'Error: ' + error.message;
    resultElement.style.color = '#d93025';
  });
}

// Function to call the translate API
async function callTranslateAPI(text, resultElement) {
  console.log('Calling translate API for text:', text);
  resultElement.textContent = 'Loading translation...';
  resultElement.style.color = '#666';
  resultElement.style.fontStyle = 'italic';
  
  fetch('https://context-reader.vercel.app/api/translate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ 
      text, 
      options: {
        style: 'simple',
        preserveContext: true,
        simplifyLanguage: true
      }
    }),
  })
  .then(response => {
    console.log('Response status:', response.status);
    return response.json();
  })
  .then(data => {
    console.log('Response data:', data);
    if (data.translation) {
      resultElement.textContent = data.translation;
      resultElement.style.color = '#333';
      resultElement.style.fontStyle = 'normal';
    } else if (data.error) {
      resultElement.textContent = 'Error: ' + data.error;
      resultElement.style.color = '#d93025';
    } else {
      resultElement.textContent = 'Received response but no translation found';
    }
  })
  .catch(error => {
    console.error('Error calling translate API:', error);
    resultElement.textContent = 'Error: ' + error.message;
    resultElement.style.color = '#d93025';
  });
}

// Function to create a floating button that can be used when no text is selected
function createFloatingButton() {
  // Remove any existing button
  const existingButton = document.getElementById('context-reader-button');
  if (existingButton) {
    document.body.removeChild(existingButton);
  }
  
  const floatButton = document.createElement('button');
  floatButton.id = 'context-reader-button';
  floatButton.textContent = 'CR';
  floatButton.style.position = 'fixed';
  floatButton.style.bottom = '20px';
  floatButton.style.right = '20px';
  floatButton.style.zIndex = '2147483647';
  floatButton.style.backgroundColor = '#4285f4';
  floatButton.style.color = 'white';
  floatButton.style.border = 'none';
  floatButton.style.borderRadius = '50%';
  floatButton.style.width = '40px';
  floatButton.style.height = '40px';
  floatButton.style.cursor = 'pointer';
  floatButton.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.2)';
  floatButton.style.fontSize = '14px';
  floatButton.style.fontWeight = 'bold';
  floatButton.title = 'Select text to use ContextReader';
  
  document.body.appendChild(floatButton);
  return floatButton;
}

// Initialize the extension
document.addEventListener('DOMContentLoaded', function() {
  console.log('DOM fully loaded, initializing ContextReader');
  // Create the floating button
  setTimeout(createFloatingButton, 1000);
});

// If the document is already loaded, initialize immediately
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  console.log('Document already loaded, initializing immediately');
  setTimeout(createFloatingButton, 1000);
}

// Listen for messages from the extension popup/background
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'manualActivate') {
    // Create a popup with empty text at the center of the viewport
    const x = window.innerWidth / 2 - 175; // Half the popup width
    const y = window.innerHeight / 3;
    createPopupUI(x, y, '');
    sendResponse({ success: true });
  }
  return true;
});

console.log('ContextReader: Extension initialized');
