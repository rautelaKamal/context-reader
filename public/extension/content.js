// Content script for ContextReader extension
console.log('ContextReader: Content script loaded');

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
    console.log('ContextReader: Message received:', event.data);
    if (!this.selectedText) {
      console.error('ContextReader: No text selected');
      this.showResult('Error: Please select some text first');
      return;
    }

    if (event.data.type === 'explain') {
      console.log('ContextReader: Explain message received');
      this.explain();
    } else if (event.data.type === 'translate') {
      console.log('ContextReader: Translate message received for text:', this.selectedText);
      this.translate();
    }
  }

  handleTextSelection() {
    console.log('ContextReader: Mouse up detected');
    const selection = window.getSelection();
    const selectedText = selection?.toString().trim();
    
    if (!selectedText) {
      console.log('ContextReader: No text selected');
      return;
    }

    console.log('ContextReader: Text selected:', selectedText);
    this.selectedText = selectedText;
    
    // Get selection coordinates
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    
    // Calculate popup position
    const x = rect.left + window.scrollX;
    const y = rect.bottom + window.scrollY;
    console.log('ContextReader: Showing popup at:', x, y);
    
    this.showPopup(x, y);
    
    // Prevent the click handler from immediately hiding the popup
    this.justCreatedPopup = true;
    setTimeout(() => {
      this.justCreatedPopup = false;
    }, 100);
  }

  handleClick(event) {
    // Don't hide the popup if we just created it
    if (this.justCreatedPopup) {
      console.log('ContextReader: Ignoring click due to recent popup creation');
      return;
    }

    // Check if clicked element is inside popup
    if (this.popup && this.popup.contains(event.target)) {
      return;
    }
    
    // Hide popup if clicked outside
    if (this.popup) {
      this.hidePopup();
    }
  }

  showPopup(x, y) {
    if (this.popup) {
      this.hidePopup();
    }

    // Create popup container
    this.popup = document.createElement('div');
    this.popup.className = 'context-reader-popup';
    
    // Create and set up iframe
    const iframe = document.createElement('iframe');
    // Check if running in extension context
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      iframe.src = chrome.runtime.getURL('popup.html');
    } else {
      // Fallback for development environment
      iframe.src = '/extension/popup.html';
      console.warn('ContextReader: Running outside extension context, using fallback path');
    }
    iframe.style.border = 'none';
    iframe.style.width = '300px';
    iframe.style.height = '150px';
    this.popup.appendChild(iframe);

    // Add popup to page
    document.body.appendChild(this.popup);

    // Position popup
    const popupRect = this.popup.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const padding = 10;

    let top = y + padding;
    let left = Math.min(x, viewportWidth - popupRect.width - padding);

    // Check if popup would go below viewport
    if (top + popupRect.height > viewportHeight) {
      // Position above the selection if not enough space below
      top = y - popupRect.height - padding;
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
  }

  hidePopup() {
    if (this.popup && this.popup.parentNode) {
      this.popup.parentNode.removeChild(this.popup);
      this.popup = null;
    }
  }

  async explain() {
    if (!this.selectedText) {
      console.error('ContextReader: No text selected');
      return;
    }

    const iframe = this.popup?.querySelector('iframe');
    if (!iframe) {
      console.error('ContextReader: Iframe not found');
      return;
    }

    this.showResult('Loading explanation...');

    try {
      console.log('ContextReader: Sending explanation request for text:', this.selectedText);
      const response = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({
          type: 'explain',
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
      
      if (!response.data.explanation) {
        throw new Error('No explanation received from API');
      }

      this.showResult(response.data.explanation);
    } catch (error) {
      console.error('ContextReader: Error getting explanation:', error);
      this.showResult(`Error: ${error.message}`);
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
new ContextReader();
console.log('ContextReader: Extension started');
