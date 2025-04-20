// Content script for ContextReader extension
console.log('ContextReader: Content script loaded');

class ContextReader {
  constructor() {
    console.log('ContextReader: Initializing...');
    this.annotations = new Map();
    this.selectedText = '';
    this.popup = null;
    this.justCreatedPopup = false;
    // Set API URL to Vercel deployment
    this.API_BASE_URL = 'https://context-reader.vercel.app';
    console.log('ContextReader: Using API URL:', this.API_BASE_URL);
    
    // Bind event handlers
    this.handleTextSelection = this.handleTextSelection.bind(this);
    this.handleClick = this.handleClick.bind(this);
    
    // Add event listeners
    document.addEventListener('mouseup', this.handleTextSelection);
    document.addEventListener('click', this.handleClick);
    
    this.setupEventListeners();
    this.loadAnnotations();
    console.log('ContextReader: Initialization complete');
  }

  setupEventListeners() {
    console.log('ContextReader: Setting up event listeners...');
    // Event listeners are already added in the constructor
    console.log('ContextReader: Event listeners setup complete');
  }

  handleTextSelection() {
    console.log('ContextReader: Mouse up detected');
    const selection = window.getSelection();
    const selectedText = selection?.toString().trim();
    console.log('ContextReader: Selected text:', selectedText);
    
    if (!selectedText) {
      console.log('ContextReader: No text selected');
      return;
    }

    this.selectedText = selectedText;
    
    // Get selection coordinates
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    console.log('ContextReader: Selection rect:', rect);
    
    console.log('ContextReader: Showing popup');
    
    this.showPopup();
    
    // Prevent the click handler from immediately hiding the popup
    this.justCreatedPopup = true;
    setTimeout(() => {
      this.justCreatedPopup = false;
    }, 100);
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
      event.preventDefault();
      event.stopPropagation();
      this.explain();
      return;
    }
    
    if (event.target.matches('.translate-btn')) {
      console.log('ContextReader: Translate button clicked with selected text:', this.selectedText);
      event.preventDefault();
      event.stopPropagation();
      this.translate();
      return;
    }

    // Check if clicked element is inside popup
    if (this.popup && this.popup.contains(event.target)) {
      console.log('ContextReader: Click inside popup');
      return;
    }
    
    // Hide popup if clicked outside
    if (this.popup) {
      console.log('ContextReader: Clicked outside popup, hiding it');
      this.hidePopup();
    }
  }

  showPopup() {
    console.log('ContextReader: Creating popup...');
    if (this.popup) {
      console.log('ContextReader: Removing existing popup');
      this.hidePopup();
    }

    // Log the selected text for debugging
    console.log('ContextReader: Creating popup for text:', this.selectedText);

    this.popup = document.createElement('div');
    this.popup.className = 'context-reader-popup';
    
    // Add clean, professional inline styles
    this.popup.style.position = 'fixed'; // Keep using fixed for better visibility
    this.popup.style.zIndex = '2147483647'; // Maximum z-index
    this.popup.style.backgroundColor = 'white';
    this.popup.style.color = '#333';
    this.popup.style.border = '1px solid #ccc';
    this.popup.style.borderRadius = '8px';
    this.popup.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
    this.popup.style.padding = '16px';
    this.popup.style.width = '320px';
    this.popup.style.maxWidth = '80vw';
    this.popup.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    this.popup.style.fontSize = '14px';
    
    this.popup.innerHTML = `
      <div class="popup-buttons" style="display: flex; gap: 8px; margin-bottom: 10px;">
        <button class="explain-btn" style="background-color: #4285f4; color: white; border: none; border-radius: 4px; padding: 6px 12px; cursor: pointer; font-size: 14px;">Explain</button>
        <button class="translate-btn" style="background-color: #4285f4; color: white; border: none; border-radius: 4px; padding: 6px 12px; cursor: pointer; font-size: 14px;">Translate</button>
      </div>
      <div class="context-reader-result" style="margin-top: 10px; padding: 8px; background-color: #f5f5f5; border-radius: 4px; max-height: 300px; overflow-y: auto; display: block; line-height: 1.5;">Selected text: "${this.selectedText}"</div>
    `;
    
    // Add direct event listeners to the buttons
    const explainBtn = this.popup.querySelector('.explain-btn');
    const translateBtn = this.popup.querySelector('.translate-btn');
    
    if (explainBtn) {
      explainBtn.addEventListener('click', () => {
        console.log('ContextReader: Explain button clicked directly');
        this.explain();
      });
    }
    
    if (translateBtn) {
      translateBtn.addEventListener('click', () => {
        console.log('ContextReader: Translate button clicked directly');
        this.translate();
      });
    }

    document.body.appendChild(this.popup);
    console.log('ContextReader: Popup added to DOM');

    // Always position the popup in the center of the viewport for testing

    // Center the popup in the viewport
    this.popup.style.top = '50%';
    this.popup.style.left = '50%';
    this.popup.style.transform = 'translate(-50%, -50%)';
    
    console.log('ContextReader: Popup positioned at center of viewport');
    
    // Add a message about the selected text
    const resultDiv = this.popup.querySelector('.context-reader-result');
    if (resultDiv) {
      resultDiv.textContent = `Selected text: "${this.selectedText}"`;
      resultDiv.style.display = 'block';
    }
  }

  hidePopup() {
    if (this.popup && this.popup.parentNode) {
      this.popup.parentNode.removeChild(this.popup);
      this.popup = null;
      console.log('ContextReader: Popup hidden');
    }
  }

  async explain() {
    console.log('ContextReader: Getting explanation...');
    if (!this.selectedText) {
      console.log('ContextReader: No text selected for explanation');
      return;
    }

    const resultDiv = this.popup.querySelector('.context-reader-result');
    resultDiv.textContent = 'Loading explanation...';
    resultDiv.style.display = 'block';
    
    // Show the result div is visible for debugging
    console.log('ContextReader: Result div displayed with loading message');
    console.log('ContextReader: Result div style.display =', resultDiv.style.display);
    
    // Show a clear message about the API call we're about to make
    console.log('ContextReader: About to make API call to:', this.API_BASE_URL);
    resultDiv.textContent = `Loading explanation from ${this.API_BASE_URL}...`;

    try {
      // Show a message in the result div
      resultDiv.textContent = `Sending request to ${this.API_BASE_URL}/api/explain...`;
      
      const apiUrl = `${this.API_BASE_URL}/api/explain`;
      console.log('ContextReader: Making API request to:', apiUrl);
      console.log('ContextReader: Selected text:', this.selectedText);
      
      // Log the request details
      console.log('ContextReader: Request details:', {
        url: apiUrl,
        method: 'POST',
        text: this.selectedText,
        origin: window.location.origin
      });
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Origin': window.location.origin
        },
        mode: 'cors',
        credentials: 'omit',
        body: JSON.stringify({
          text: this.selectedText,
          url: window.location.href
        })
      });
      
      console.log('ContextReader: Fetch request completed');

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
      
      // Show detailed error information
      let errorMessage = 'Error: Could not get explanation. ';
      
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        errorMessage += 'Network error - could not connect to the API server. This might be due to CORS restrictions or the server being unavailable.';
      } else if (error.name === 'SyntaxError') {
        errorMessage += 'Received invalid response from the server.';
      } else {
        errorMessage += error.message || 'Check console for details.';
      }
      
      this.showResult(errorMessage);
      
      // Display the error in the console with more details
      console.error('ContextReader: Detailed error information:', {
        name: error.name,
        message: error.message,
        stack: error.stack,
        apiUrl: this.API_BASE_URL
      });
    }
  }

  async translate() {
    console.log('ContextReader: Getting translation...');
    if (!this.selectedText) return;

    const resultDiv = this.popup.querySelector('.context-reader-result');
    resultDiv.textContent = 'Loading translation...';
    resultDiv.style.display = 'block';

    try {
      console.log('ContextReader: Making API request to:', `${this.API_BASE_URL}/api/translate`);
      const response = await fetch(`${this.API_BASE_URL}/api/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: this.selectedText,
          url: window.location.href
        })
      });

      console.log('ContextReader: Translation response status:', response.status);
      const data = await response.json();
      console.log('ContextReader: Translation data:', data);

      if (data.translation) {
        console.log('ContextReader: Got translation:', data.translation);
        this.showResult(data.translation);
      } else if (data.error) {
        console.error('ContextReader: API error:', data.error);
        this.showResult(`Error: ${data.error}`);
      }
    } catch (error) {
      console.error('ContextReader: Error getting translation:', error);
      this.showResult('Error: Could not get translation. Check console for details.');
    }
  }

  showResult(text) {
    if (!this.popup) return;

    const resultDiv = this.popup.querySelector('.context-reader-result');
    if (resultDiv) {
      resultDiv.textContent = text;
      resultDiv.style.display = 'block';
      console.log('ContextReader: Showing result:', text);
    }
  }

  async loadAnnotations() {
    console.log('ContextReader: Loading annotations...');
    const stored = localStorage.getItem('contextReaderAnnotations');
    if (stored) {
      const annotations = JSON.parse(stored);
      this.annotations = new Map(Object.entries(annotations));
      console.log('ContextReader: Loaded annotations:', this.annotations.size);
    }
  }

  saveAnnotations() {
    const annotations = Object.fromEntries(this.annotations);
    localStorage.setItem('contextReaderAnnotations', JSON.stringify(annotations));
    console.log('ContextReader: Saved annotations');
  }
}

// Initialize the extension
console.log('ContextReader: Starting extension...');
new ContextReader();
console.log('ContextReader: Extension started');
