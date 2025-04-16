interface Annotation {
  text: string;
  explanation?: string;
  translation?: string;
  timestamp: number;
}

class ContextReader {
  private annotations: Map<string, Annotation> = new Map();
  private selectedText: string = '';
  private popup: HTMLElement | null = null;
  private API_BASE_URL = 'http://localhost:3004';

  constructor() {
    this.initializeUI();
    this.setupEventListeners();
    this.loadAnnotations();
  }

  private initializeUI() {
    const styles = document.createElement('style');
    styles.textContent = `
      .context-reader-popup {
        position: fixed;
        background: white;
        border: 1px solid #ccc;
        border-radius: 4px;
        padding: 10px;
        box-shadow: 0 2px 5px rgba(0,0,0,0.2);
        z-index: 10000;
        max-width: 300px;
      }
      .context-reader-popup button {
        margin: 5px;
        padding: 5px 10px;
        border: none;
        border-radius: 3px;
        background: #007bff;
        color: white;
        cursor: pointer;
      }
      .context-reader-popup button:hover {
        background: #0056b3;
      }
      .context-reader-result {
        margin-top: 10px;
        padding: 10px;
        background: #f8f9fa;
        border-radius: 3px;
      }
    `;
    document.head.appendChild(styles);
  }

  private setupEventListeners() {
    document.addEventListener('mouseup', this.handleTextSelection.bind(this));
    document.addEventListener('click', this.handleClick.bind(this));
  }

  private async loadAnnotations() {
    const stored = localStorage.getItem('contextReaderAnnotations');
    if (stored) {
      const annotations = JSON.parse(stored);
      this.annotations = new Map(Object.entries(annotations));
    }
  }

  private saveAnnotations() {
    const annotations = Object.fromEntries(this.annotations);
    localStorage.setItem('contextReaderAnnotations', JSON.stringify(annotations));
  }

  private handleTextSelection(event: MouseEvent) {
    const selection = window.getSelection();
    if (!selection || selection.toString().trim() === '') {
      return;
    }

    this.selectedText = selection.toString().trim();
    this.showPopup(event.pageX, event.pageY);
  }

  private handleClick(event: MouseEvent) {
    if (!this.popup?.contains(event.target as Node)) {
      this.hidePopup();
    }
  }

  private showPopup(x: number, y: number) {
    if (this.popup) {
      this.hidePopup();
    }

    this.popup = document.createElement('div');
    this.popup.className = 'context-reader-popup';
    this.popup.innerHTML = `
      <button id="explain-btn">Explain</button>
      <button id="translate-btn">Translate</button>
      <div id="result" class="context-reader-result" style="display: none;"></div>
    `;

    document.body.appendChild(this.popup);

    // Position the popup
    const popupRect = this.popup.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;

    let top = y + window.scrollY;
    let left = x + window.scrollX;

    if (top + popupRect.height > viewportHeight) {
      top = y - popupRect.height;
    }
    if (left + popupRect.width > viewportWidth) {
      left = x - popupRect.width;
    }

    this.popup.style.top = `${top}px`;
    this.popup.style.left = `${left}px`;

    // Add event listeners
    this.popup.querySelector('#explain-btn')?.addEventListener('click', () => this.explain());
    this.popup.querySelector('#translate-btn')?.addEventListener('click', () => this.translate());
  }

  private hidePopup() {
    if (this.popup && this.popup.parentNode) {
      this.popup.parentNode.removeChild(this.popup);
      this.popup = null;
    }
  }

  private async explain() {
    if (!this.selectedText) return;

    try {
      const response = await fetch(`${this.API_BASE_URL}/api/explain`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: this.selectedText,
          url: window.location.href
        })
      });

      const data = await response.json();
      if (data.explanation) {
        this.showResult(data.explanation);
        this.saveAnnotation(this.selectedText, data.explanation);
      }
    } catch (error) {
      console.error('Error getting explanation:', error);
      this.showResult('Error: Could not get explanation');
    }
  }

  private async translate() {
    if (!this.selectedText) return;

    try {
      const response = await fetch(`${this.API_BASE_URL}/api/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: this.selectedText,
          url: window.location.href
        })
      });

      const data = await response.json();
      if (data.translation) {
        this.showResult(data.translation);
        this.saveAnnotation(this.selectedText, undefined, data.translation);
      }
    } catch (error) {
      console.error('Error getting translation:', error);
      this.showResult('Error: Could not get translation');
    }
  }

  private showResult(text: string) {
    if (!this.popup) return;

    const resultDiv = this.popup.querySelector('#result');
    if (resultDiv) {
      resultDiv.textContent = text;
      resultDiv.style.display = 'block';
    }
  }

  private saveAnnotation(text: string, explanation?: string, translation?: string) {
    const annotation: Annotation = {
      text,
      explanation,
      translation,
      timestamp: Date.now()
    };

    this.annotations.set(text, annotation);
    this.saveAnnotations();
  }
}

// Initialize the extension
new ContextReader();
