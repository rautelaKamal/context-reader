// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const resultDiv = document.querySelector('.context-reader-result');
  
  // Listen for messages from the parent
  window.addEventListener('message', (event) => {
    console.log('Popup received message:', event.data);
    
    if (event.data.type === 'setText') {
      window.selectedText = event.data.text;
      console.log('Popup: Text set to:', window.selectedText);
    } else if (event.data.type === 'showResult') {
      console.log('Popup: Showing result:', event.data.text);
      if (resultDiv) {
        // Show error in red if it starts with 'Error:'
        if (typeof event.data.text === 'string' && event.data.text.startsWith('Error:')) {
          resultDiv.textContent = event.data.text;
          resultDiv.style.color = '#c00';
          resultDiv.style.fontWeight = 'bold';
        } else if (typeof event.data.text === 'string' && event.data.text.toLowerCase().includes('loading')) {
          resultDiv.textContent = event.data.text + '...';
          resultDiv.style.color = '#888';
          resultDiv.style.fontWeight = 'normal';
        } else {
          resultDiv.textContent = event.data.text;
          resultDiv.style.color = '#1a1a1a';
          resultDiv.style.fontWeight = '500';
        }
        resultDiv.style.display = 'block';
      } else {
        console.error('Popup: Result div not found');
      }
    }
  });
});

// Add button click handlers when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const explainBtn = document.getElementById('explain-btn');
  const translateBtn = document.getElementById('translate-btn');
  
  if (explainBtn) {
    explainBtn.addEventListener('click', () => {
      console.log('Popup: Explain button clicked');
      window.parent.postMessage({ type: 'explain', text: window.selectedText }, '*');
    });
  } else {
    console.error('Popup: Explain button not found');
  }
  
  if (translateBtn) {
    translateBtn.addEventListener('click', () => {
      console.log('Popup: Translate button clicked');
      window.parent.postMessage({ type: 'translate', text: window.selectedText }, '*');
    });
  } else {
    console.error('Popup: Translate button not found');
  }
});
