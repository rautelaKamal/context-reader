// Content script for ContextReader extension
console.log('ContextReader: Content script loaded');

class ContextReader {
  constructor() {
    console.log('ContextReader: Initializing...');
    this.selectedText = '';
    this.popup = null;
    
    // Set API URL to Vercel deployment
    this.API_BASE_URL = 'https://context-reader.vercel.app';
    console.log('ContextReader: Using API URL:', this.API_BASE_URL);
    
    // Add event listeners
    document.addEventListener('mouseup', this.handleTextSelection.bind(this));
    
    console.log('ContextReader: Initialization complete');
  }

  handleTextSelection() {
    try {
      console.log('ContextReader: Mouse up detected');
      const selection = window.getSelection();
      const selectedText = selection?.toString().trim();
      console.log('ContextReader: Selected text:', selectedText);
      
      if (!selectedText) {
        console.log('ContextReader: No text selected');
        return;
      }

      this.selectedText = selectedText;
      this.showPopup();
    } catch (error) {
      console.error('ContextReader: Error handling text selection:', error);
    }
  }

  showPopup() {
    try {
      console.log('ContextReader: Creating popup...');
      if (this.popup) {
        console.log('ContextReader: Removing existing popup');
        this.hidePopup();
      }

      // Create a fixed position popup
      this.popup = document.createElement('div');
      this.popup.style.position = 'fixed';
      this.popup.style.top = '50%';
      this.popup.style.left = '50%';
      this.popup.style.transform = 'translate(-50%, -50%)';
      this.popup.style.zIndex = '2147483647';
      this.popup.style.backgroundColor = 'white';
      this.popup.style.padding = '20px';
      this.popup.style.borderRadius = '8px';
      this.popup.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
      this.popup.style.width = '320px';
      this.popup.style.fontFamily = 'Arial, sans-serif';

    // Create popup content
    const header = document.createElement('h3');
    header.textContent = 'ContextReader';
    header.style.margin = '0 0 10px 0';

    const selectedTextDisplay = document.createElement('div');
    selectedTextDisplay.textContent = `"${this.selectedText}"`;
    selectedTextDisplay.style.padding = '10px';
    selectedTextDisplay.style.backgroundColor = '#f5f5f5';
    selectedTextDisplay.style.borderRadius = '4px';
    selectedTextDisplay.style.marginBottom = '15px';

    const buttonContainer = document.createElement('div');
    buttonContainer.style.display = 'flex';
    buttonContainer.style.gap = '10px';

    const explainButton = document.createElement('button');
    explainButton.textContent = 'Explain';
    explainButton.style.backgroundColor = '#4285f4';
    explainButton.style.color = 'white';
    explainButton.style.border = 'none';
    explainButton.style.padding = '8px 16px';
    explainButton.style.borderRadius = '4px';
    explainButton.style.cursor = 'pointer';

    const translateButton = document.createElement('button');
    translateButton.textContent = 'Translate';
    translateButton.style.backgroundColor = '#4285f4';
    translateButton.style.color = 'white';
    translateButton.style.border = 'none';
    translateButton.style.padding = '8px 16px';
    translateButton.style.borderRadius = '4px';
    translateButton.style.cursor = 'pointer';

    const resultArea = document.createElement('div');
    resultArea.id = 'result-area';
    resultArea.style.marginTop = '15px';
    resultArea.style.padding = '10px';
    resultArea.style.backgroundColor = '#f5f5f5';
    resultArea.style.borderRadius = '4px';
    resultArea.style.minHeight = '50px';
    resultArea.style.display = 'none';

    // Add event listeners
    explainButton.addEventListener('click', () => {
      console.log('Explain button clicked');
      this.callExplainAPI();
    });

    translateButton.addEventListener('click', () => {
      console.log('Translate button clicked');
      this.callTranslateAPI();
    });

    // Close button
    const closeButton = document.createElement('button');
    closeButton.textContent = 'X';
    closeButton.style.position = 'absolute';
    closeButton.style.top = '10px';
    closeButton.style.right = '10px';
    closeButton.style.backgroundColor = 'transparent';
    closeButton.style.border = 'none';
    closeButton.style.fontSize = '16px';
    closeButton.style.cursor = 'pointer';
    closeButton.addEventListener('click', () => this.hidePopup());

    // Assemble the popup
    buttonContainer.appendChild(explainButton);
    buttonContainer.appendChild(translateButton);

    this.popup.appendChild(closeButton);
    this.popup.appendChild(header);
    this.popup.appendChild(selectedTextDisplay);
    this.popup.appendChild(buttonContainer);
    this.popup.appendChild(resultArea);

    // Add to DOM
    document.body.appendChild(this.popup);
    console.log('ContextReader: Popup created and added to DOM');
    } catch (error) {
      console.error('ContextReader: Error creating popup:', error);
      // Reset the popup state to prevent further errors
      this.popup = null;
    }
  }

  hidePopup() {
    try {
      if (this.popup && this.popup.parentNode) {
        this.popup.parentNode.removeChild(this.popup);
        this.popup = null;
        console.log('ContextReader: Popup hidden');
      }
    } catch (error) {
      console.error('ContextReader: Error hiding popup:', error);
      // Reset the popup state to prevent further errors
      this.popup = null;
    }
  }

  async callExplainAPI() {
    try {
      console.log('ContextReader: Getting explanation...');
      if (!this.selectedText) {
        console.log('ContextReader: No text selected for explanation');
        return;
      }
      
      if (!this.popup) {
        console.error('ContextReader: Popup is not available');
        return;
      }

      const resultDiv = this.popup.querySelector('.context-reader-result');
      if (!resultDiv) {
        console.error('ContextReader: Result div not found');
        return;
      }
      
      resultDiv.textContent = 'Loading explanation...';
      resultDiv.style.display = 'block';
      
      // Show the result div is visible for debugging
      console.log('ContextReader: Result div displayed with loading message');
      console.log('ContextReader: Result div style.display =', resultDiv.style.display);

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
    } catch (error) {
      console.error('ContextReader: Extension context error in callExplainAPI:', error);
      // If we get here, the extension context is likely invalidated
    }
  }

  async translate() {
    try {
      console.log('ContextReader: Getting translation...');
      if (!this.selectedText) return;
      
      if (!this.popup) {
        console.error('ContextReader: Popup is not available');
        return;
      }

      const resultDiv = this.popup.querySelector('.context-reader-result');
      if (!resultDiv) {
        console.error('ContextReader: Result div not found');
        return;
      }
      
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
    } catch (error) {
      console.error('ContextReader: Extension context error in translate:', error);
      // If we get here, the extension context is likely invalidated
    }
  }

  showResult(text) {
    try {
      if (!this.popup) {
        console.error('ContextReader: Popup is not available');
        return;
      }
      
      const resultDiv = this.popup.querySelector('.context-reader-result');
      if (!resultDiv) {
        console.error('ContextReader: Result div not found');
        return;
      }
      
      resultDiv.textContent = text;
      resultDiv.style.display = 'block';
      console.log('ContextReader: Showing result:', text);
    } catch (error) {
      console.error('ContextReader: Error showing result:', error);
    }
  }

  async loadAnnotations() {
    try {
      console.log('ContextReader: Loading annotations...');
      const stored = localStorage.getItem('contextReaderAnnotations');
      if (stored) {
        const annotations = JSON.parse(stored);
        this.annotations = new Map(Object.entries(annotations));
        console.log('ContextReader: Loaded annotations:', this.annotations.size);
      }
    } catch (error) {
      console.error('ContextReader: Error loading annotations:', error);
    }
  }

  saveAnnotations() {
    try {
      const annotations = Object.fromEntries(this.annotations);
      localStorage.setItem('contextReaderAnnotations', JSON.stringify(annotations));
      console.log('ContextReader: Saved annotations');
    } catch (error) {
      console.error('ContextReader: Error saving annotations:', error);
    }
  }
}

// Initialize the extension
console.log('ContextReader: Starting extension...');
new ContextReader();
console.log('ContextReader: Extension started');
