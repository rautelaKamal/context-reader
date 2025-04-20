// Content script for ContextReader extension
console.log('ContextReader: Content script loaded');

class ContextReader {
  constructor() {
    console.log('ContextReader: Initializing...');
    this.annotations = new Map();
    this.selectedText = '';
    this.popup = null;
    this.justCreatedPopup = false;
    // Dynamically determine API URL - use current origin if not localhost, otherwise use localhost:3000
    const currentOrigin = window.location.origin;
    this.API_BASE_URL = currentOrigin.includes('localhost') ? 'http://localhost:3000' : 'https://context-reader.vercel.app';
    
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

  showPopup(x, y) {
    console.log('ContextReader: Creating popup...');
    if (this.popup) {
      console.log('ContextReader: Removing existing popup');
      this.hidePopup();
    }

    this.popup = document.createElement('div');
    this.popup.className = 'context-reader-popup';
    this.popup.innerHTML = `
      <div class="popup-buttons">
        <button class="explain-btn">Explain</button>
        <button class="translate-btn">Translate</button>
      </div>
      <div class="context-reader-result"></div>
    `;

    document.body.appendChild(this.popup);
    console.log('ContextReader: Popup added to DOM');

    // Position the popup
    const popupRect = this.popup.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;

    let top = y;
    let left = x;

    if (top + popupRect.height > viewportHeight) {
      top = y - popupRect.height;
    }
    if (left + popupRect.width > viewportWidth) {
      left = x - popupRect.width;
    }

    this.popup.style.top = `${top}px`;
    this.popup.style.left = `${left}px`;
    console.log('ContextReader: Popup positioned at:', { top, left });
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

    try {
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
