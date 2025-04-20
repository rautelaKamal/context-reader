// Content script for ContextReader extension
console.log('ContextReader: Content script loaded - ' + new Date().toISOString());

// Add global listener for messages from iframe
window.addEventListener('message', (event) => {
  console.log('ContextReader: DIRECT Global message received:', event.data);
  
  // Check if message is from our popup
  if (event.data && (event.data.type === 'explain' || event.data.type === 'translate')) {
    console.log('ContextReader: Action button clicked in popup:', event.data.type);
    
    // Get the ContextReader instance
    const readers = window._contextReaders || [];
    if (readers.length > 0) {
      const reader = readers[readers.length - 1];
      if (event.data.type === 'explain') {
        reader.explain();
      } else if (event.data.type === 'translate') {
        reader.translate();
      }
    } else {
      console.error('ContextReader: No reader instance found to handle', event.data.type);
    }
  }
});

class ContextReader {
  constructor() {
    console.log('ContextReader: Initializing...');
    this.annotations = new Map();
    this.selectedText = '';
    this.popup = null;
    this.justCreatedPopup = false;
    
    // Get API base URL based on extension development mode
    this.API_BASE_URL = chrome?.runtime?.getManifest()?.version?.includes('dev')
      ? 'http://localhost:3000'
      : 'https://context-reader.onrender.com';
    
    // Bind event handlers
    this.handleTextSelection = this.handleTextSelection.bind(this);
    this.handleClick = this.handleClick.bind(this);
    this.handleMessage = this.handleMessage.bind(this);
    
    // Set up event listeners
    this.setupEventListeners();
    this.loadAnnotations();
    console.log('ContextReader: Initialization complete');
  }

  setupEventListeners() {
    console.log('ContextReader: Setting up event listeners...');
    document.addEventListener('mouseup', this.handleTextSelection);
    document.addEventListener('click', this.handleClick);
    window.addEventListener('message', this.handleMessage);
    console.log('ContextReader: Event listeners setup complete');
  }

  handleMessage(event) {
    console.log('ContextReader: handleMessage received:', event.data);
    
    if (event.data.type === 'explain') {
      console.log('ContextReader: Explain message received in handleMessage');
      if (!this.selectedText) {
        console.error('ContextReader: No text selected');
        this.showResult('Error: Please select some text first');
        return;
      }
      this.explain();
    } else if (event.data.type === 'translate') {
      console.log('ContextReader: Translate message received in handleMessage');
      if (!this.selectedText) {
        console.error('ContextReader: No text selected');
        this.showResult('Error: Please select some text first');
        return;
      }
      this.translate();
    }
  }

  handleTextSelection() {
    console.log('ContextReader: Mouse up detected');
    
    // Get selected text
    const selection = window.getSelection();
    const selectedText = selection.toString().trim();

    if (selectedText) {
      console.log('ContextReader: Text selected:', selectedText);
      this.selectedText = selectedText;
      
      // Get selection coordinates
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      
      // Show popup below the selection
      console.log('ContextReader: Showing popup below selection at:', rect.left, rect.bottom);
      this.showPopup(rect.left, rect.bottom);

      // AUTOMATICALLY call explain without waiting for button click
      console.log('ContextReader: Automatically calling explain...');
      setTimeout(() => {
        console.log('ContextReader: Delayed automatic explain() call');
        alert('AUTO-CALLING API: ' + this.selectedText);
        this.explain();
      }, 1000); // 1-second delay to ensure popup is created first
    } else {
      console.log('ContextReader: No text selected');
      this.selectedText = '';
      this.hidePopup();
    }
    
    // Prevent default context menu from immediately hiding the popup
    this.justCreatedPopup = true;
    setTimeout(() => {
      this.justCreatedPopup = false;
    }, 500); // Increased delay to prevent premature hiding
  }

  handleClick(event) {
    console.log('ContextReader: Click detected on:', event.target.outerHTML);

    // Don't hide the popup if we just created it
    if (this.justCreatedPopup) {
      console.log('ContextReader: Ignoring click due to recent popup creation');
      return;
    }

    // Handle button clicks
    if (event.target.matches('.explain-btn')) {
      console.log('ContextReader: Explain button clicked with selected text:', this.selectedText);
      if (!this.selectedText) {
        console.error('ContextReader: No text selected when Explain button clicked');
      }
      event.preventDefault();
      event.stopPropagation();
      this.explain();
      return;
    }
    
    // Hide popup if clicked outside
    if (this.popup) {
      this.hidePopup();
    }
  }

  hidePopup() {
    if (this.popup && this.popup.parentNode) {
      this.popup.parentNode.removeChild(this.popup);
      this.popup = null;
    }
  }

  async explain() {
    try {
      console.log('ContextReader: Getting explanation...');
      if (!this.selectedText) {
        console.error('ContextReader: No text selected for explanation');
        return;
      }

      const resultDiv = this.popup.querySelector('.context-reader-result');
      resultDiv.textContent = 'Loading explanation...';
      resultDiv.style.display = 'block';

      const apiUrl = `${this.API_BASE_URL}/api/explain`;
      console.log('ContextReader: Making API request to:', apiUrl);
      console.log('ContextReader: Selected text:', this.selectedText);

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: this.selectedText,
          url: window.location.href
        })
      });

      console.log('ContextReader: Response status:', response.status);
      const data = await response.json();
      console.log('ContextReader: Response data:', data);

      if (data.explanation) {
        console.log('ContextReader: Got explanation:', data.explanation);
        this.showResult(data.explanation);
      } else if (data.error) {
        console.error('ContextReader: API error:', data.error);
        this.showResult(`Error: ${data.error}`);
      }
    } catch (error) {
      console.error('ContextReader: Error getting explanation:', error);
      this.showResult('Error: Could not get explanation. Check console for details.');
    }
  }

  async translate() {
    if (!this.selectedText) {
      console.error('ContextReader: No text selected');
      return;
    }

    this.showResult('Loading translation...');

    try {
      console.log('ContextReader: Sending translation request for text:', this.selectedText);
      const response = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({
          type: 'translate',
          text: this.selectedText,
          url: window.location.href
        }, (response) => {
          if (chrome.runtime.lastError) {
            console.error('ContextReader: Chrome runtime error:', chrome.runtime.lastError);
            reject(chrome.runtime.lastError);
          } else {
            console.log('ContextReader: Received response:', response);
            resolve(response);
          }
        });
      });

      if (!response.success) {
        throw new Error(response.error);
      }
      
      if (!response.data.translation) {
        throw new Error('No translation received from API');
      }

      this.showResult(response.data.translation);
    } catch (error) {
      console.error('ContextReader: Error getting translation:', error);
      this.showResult(`Error: ${error.message}`);
    }
  }

  showResult(text) {
    const iframe = this.popup?.querySelector('iframe');
    if (!iframe) {
      console.error('ContextReader: Iframe not found');
      return;
    }

    // First increase height to accommodate the result
    iframe.style.height = '250px';
    
    // Check if iframe is loaded
    if (iframe.contentWindow) {
      try {
        iframe.contentWindow.postMessage({
          type: 'showResult',
          text: text
        }, '*');
      } catch (error) {
        console.error('ContextReader: Error sending message to iframe:', error);
      }
    } else {
      console.error('ContextReader: Iframe content window not ready');
    }
  }

  showPopup(x, y) {
    console.log('ContextReader: showPopup called at:', x, y);
    // Clear any existing popup
    if (this.popup) {
      this.hidePopup();
    }

    // Reset popup ignore state
    this.justCreatedPopup = true;

    // Create popup container using direct DOM elements (no iframe)
    this.popup = document.createElement('div');
    this.popup.className = 'context-reader-popup';
    this.popup.style.position = 'absolute';
    this.popup.style.zIndex = '999999';
    this.popup.style.background = 'white';
    this.popup.style.border = '1px solid #ccc';
    this.popup.style.borderRadius = '6px';
    this.popup.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
    this.popup.style.padding = '12px';
    this.popup.style.width = '320px';
    this.popup.style.fontFamily = '"Segoe UI", Roboto, Arial, sans-serif';
    this.popup.style.minHeight = '150px';
    
    // Create button container
    const buttonContainer = document.createElement('div');
    buttonContainer.style.display = 'flex';
    buttonContainer.style.gap = '8px';
    buttonContainer.style.marginBottom = '12px';
    
    // Create explain button with direct listener - with VERY obvious styling
    const explainBtn = document.createElement('button');
    explainBtn.textContent = 'EXPLAIN (CLICK ME)';
    explainBtn.style.flex = '1';
    explainBtn.style.padding = '12px 16px';
    explainBtn.style.border = '3px solid #ff0000';
    explainBtn.style.borderRadius = '8px';
    explainBtn.style.background = '#ff3300';
    explainBtn.style.color = 'white';
    explainBtn.style.cursor = 'pointer';
    explainBtn.style.fontSize = '16px';
    explainBtn.style.fontWeight = 'bold';
    explainBtn.style.textTransform = 'uppercase';
    explainBtn.style.boxShadow = '0 4px 8px rgba(0,0,0,0.3)';
    explainBtn.addEventListener('click', (e) => {
      console.log('ContextReader: EXPLAIN BUTTON CLICKED!');
      alert('EXPLAIN BUTTON CLICKED! Now calling API...');
      e.preventDefault();
      e.stopPropagation();
      this.explain();
    });
    
    // Create translate button with direct listener
    const translateBtn = document.createElement('button');
    translateBtn.textContent = 'Translate';
    translateBtn.style.flex = '1';
    translateBtn.style.padding = '8px 16px';
    translateBtn.style.border = '2px solid #0056b3';
    translateBtn.style.borderRadius = '4px';
    translateBtn.style.background = '#007bff';
    translateBtn.style.color = 'white';
    translateBtn.style.cursor = 'pointer';
    translateBtn.style.fontSize = '14px';
    translateBtn.addEventListener('click', (e) => {
      console.log('ContextReader: TRANSLATE BUTTON CLICKED!');
      e.preventDefault();
      e.stopPropagation();
      this.translate();
    });
    
    // Add buttons to container
    buttonContainer.appendChild(explainBtn);
    buttonContainer.appendChild(translateBtn);
    
    // Create result container
    this.resultDiv = document.createElement('div');
    this.resultDiv.className = 'context-reader-result';
    this.resultDiv.style.display = 'none';
    this.resultDiv.style.padding = '12px';
    this.resultDiv.style.border = '1px solid #e0e0e0';
    this.resultDiv.style.borderRadius = '6px';
    this.resultDiv.style.background = '#fffbe6';
    this.resultDiv.style.fontSize = '15px';
    this.resultDiv.style.lineHeight = '1.7';
    this.resultDiv.style.marginTop = '12px';
    this.resultDiv.style.wordBreak = 'break-word';
    this.resultDiv.style.color = '#1a1a1a';
    this.resultDiv.style.fontWeight = '500';
    this.resultDiv.style.maxHeight = '300px';
    this.resultDiv.style.overflowY = 'auto';
    
    // Add all elements to the popup
    this.popup.appendChild(buttonContainer);
    this.popup.appendChild(this.resultDiv);
    
    // Add popup to page
    document.body.appendChild(this.popup);

    // Wait for next frame to get correct dimensions
    requestAnimationFrame(() => {
      // Position popup
      const popupRect = this.popup.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const padding = 10;

      // Calculate initial position (below selection)
      let top = y + padding;
      let left = Math.min(x, viewportWidth - popupRect.width - padding);

      // If popup would go off the bottom of the viewport
      if (top + popupRect.height > viewportHeight) {
        // Try positioning above the selection
        const selectionRange = window.getSelection().getRangeAt(0);
        const selectionRect = selectionRange.getBoundingClientRect();
        top = selectionRect.top - popupRect.height - padding;
        
        // If that would go off the top, position at the mouse Y but scrolled into view
        if (top < 0) {
          top = Math.max(padding, y);
          // Ensure the popup is visible by scrolling if needed
          setTimeout(() => {
            this.popup.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }, 100);
        }
      }

      // Ensure left edge visibility
      left = Math.max(padding, left);

      // Add scroll offset
      top += window.scrollY;
      left += window.scrollX;

      // Apply position
      this.popup.style.position = 'absolute';
      this.popup.style.top = `${top}px`;
      this.popup.style.left = `${left}px`;
      this.popup.style.zIndex = '999999';
    });
  }

      // Make direct fetch request instead of using background script
      const response = await fetch(`${API_BASE_URL}/api/explain`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          text: this.selectedText,
          url: window.location.href
        })
      });
      
      console.log('ContextReader: Response status:', response.status);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('ContextReader: API response data:', data);
      
      if (!data.explanation) {
        throw new Error('No explanation received from API');
      }

      this.showResult(data.explanation);
    } catch (error) {
      console.error('ContextReader: Error getting explanation:', error);
      this.showResult(`Error: ${error.message || 'Failed to get explanation'}`);
      
      // Log additional CORS info if network error
      if (error instanceof TypeError) {
        console.error('ContextReader: Possible CORS or network error');
      }
    }
  }

  async translate() {
    if (!this.selectedText) {
      console.error('ContextReader: No text selected');
      return;
    }

    const iframe = this.popup?.querySelector('iframe');
    if (!iframe) {
      console.error('ContextReader: Iframe not found');
      return;
    }

    this.showResult('Loading translation...');

    try {
      console.log('ContextReader: Sending translation request for text:', this.selectedText);
      const response = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({
          type: 'translate',
          text: this.selectedText,
          url: window.location.href
        }, (response) => {
          if (chrome.runtime.lastError) {
            console.error('ContextReader: Chrome runtime error:', chrome.runtime.lastError);
            reject(chrome.runtime.lastError);
          } else {
            console.log('ContextReader: Received response:', response);
            resolve(response);
          }
        });
      });

      if (!response.success) {
        throw new Error(response.error);
      }
      
      if (!response.data.translation) {
        throw new Error('No translation received from API');
      }

      this.showResult(response.data.translation);
    } catch (error) {
      console.error('ContextReader: Error getting translation:', error);
      this.showResult(`Error: ${error.message}`);
    }
  }

  showResult(text) {
    console.log('ContextReader: showResult called with text:', text);
    
    if (!this.popup || !this.resultDiv) {
      console.error('ContextReader: Popup or result div not found');
      return;
    }
    
    // Show result div and set text
    this.resultDiv.style.display = 'block';
    
    // Handle different result types
    if (typeof text === 'string' && text.startsWith('Error:')) {
      // Show error in red
      this.resultDiv.textContent = text;
      this.resultDiv.style.color = '#c00';
      this.resultDiv.style.fontWeight = 'bold';
    } else if (typeof text === 'string' && text.toLowerCase().includes('loading')) {
      // Show loading in gray
      this.resultDiv.textContent = text;
      this.resultDiv.style.color = '#888';
      this.resultDiv.style.fontWeight = 'normal';
    } else {
      // Show normal result
      this.resultDiv.textContent = text;
      this.resultDiv.style.color = '#1a1a1a';
      this.resultDiv.style.fontWeight = '500';
    }
    
    // Ensure popup is big enough
    this.popup.style.height = 'auto';
  }

  async loadAnnotations() {
    try {
      const stored = localStorage.getItem('contextReaderAnnotations');
      if (stored) {
        const annotations = JSON.parse(stored);
        this.annotations = new Map(Object.entries(annotations));
      }
    } catch (error) {
      console.error('ContextReader: Error loading annotations:', error);
    }
  }

  saveAnnotations() {
    try {
      const annotations = Object.fromEntries(this.annotations);
      localStorage.setItem('contextReaderAnnotations', JSON.stringify(annotations));
    } catch (error) {
      console.error('ContextReader: Error saving annotations:', error);
    }
  }
}

// Initialize the extension
console.log('ContextReader: Starting extension...');

// Keep track of all reader instances
window._contextReaders = window._contextReaders || [];
window._contextReaders.push(new ContextReader());

console.log('ContextReader: Extension started, instances:', window._contextReaders.length);
