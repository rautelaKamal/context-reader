/**
 * Popup script. Extension pages run under script-src 'self', so this cannot be
 * inline in popup.html.
 */
const el = document.getElementById('allowance');

chrome.runtime.sendMessage({ type: 'usage' }, (response) => {
  if (chrome.runtime.lastError || !response?.success) {
    el.textContent = 'Free while it is free.';
    return;
  }

  const { remaining, limit } = response;
  el.textContent = remaining === 0
    ? `No explanations left today. Resets at midnight.`
    : `${remaining} of ${limit} explanations left today.`;
  el.classList.toggle('spent', remaining === 0);
});
