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
  }

  showPopup() {
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
  }

  hidePopup() {
    if (this.popup && this.popup.parentNode) {
      this.popup.parentNode.removeChild(this.popup);
      this.popup = null;
      console.log('ContextReader: Popup hidden');
    }
  }

  async callExplainAPI() {
    console.log('ContextReader: Calling explain API...');
    const resultArea = this.popup.querySelector('#result-area');
    resultArea.style.display = 'block';
    resultArea.textContent = 'Loading explanation...';

    try {
      // Make the API call
      const response = await fetch('https://context-reader.vercel.app/api/explain', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ text: this.selectedText })
      });

      console.log('Response status:', response.status);
      
      // Parse the response
      const data = await response.json();
      console.log('Response data:', data);
      
      // Display the result
      if (data.explanation) {
        resultArea.textContent = data.explanation;
      } else if (data.error) {
        resultArea.textContent = 'Error: ' + data.error;
      } else {
        resultArea.textContent = 'Received response but no explanation found';
      }
    } catch (error) {
      console.error('Error making API call:', error);
      resultArea.textContent = 'Error: ' + (error.message || 'Failed to make API call');
    }
  }

  async callTranslateAPI() {
    console.log('ContextReader: Calling translate API...');
    const resultArea = this.popup.querySelector('#result-area');
    resultArea.style.display = 'block';
    resultArea.textContent = 'Loading translation...';

    try {
      // Make the API call
      const response = await fetch('https://context-reader.vercel.app/api/translate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ text: this.selectedText })
      });

      console.log('Response status:', response.status);
      
      // Parse the response
      const data = await response.json();
      console.log('Response data:', data);
      
      // Display the result
      if (data.translation) {
        resultArea.textContent = data.translation;
      } else if (data.error) {
        resultArea.textContent = 'Error: ' + data.error;
      } else {
        resultArea.textContent = 'Received response but no translation found';
      }
    } catch (error) {
      console.error('Error making API call:', error);
      resultArea.textContent = 'Error: ' + (error.message || 'Failed to make API call');
    }
  }
}

// Initialize the extension
console.log('ContextReader: Starting extension...');
new ContextReader();
console.log('ContextReader: Extension started');
