// Popup script for ContextReader extension

document.addEventListener('DOMContentLoaded', function() {
  const toggleButton = document.getElementById('toggleButton');
  
  toggleButton.addEventListener('click', function() {
    // Send message to content script to manually activate the UI
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      chrome.tabs.sendMessage(tabs[0].id, {action: 'manualActivate'}, function(response) {
        console.log('Activation response:', response);
        // Close the popup after activating
        window.close();
      });
    });
  });
});
