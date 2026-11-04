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

  const { remaining, limit, resets } = response;
  el.textContent = remaining === 0
    ? `No explanations left today. Resets ${resets}.`
    : `${remaining} of ${limit} explanations left today, resets ${resets}.`;
  el.classList.toggle('spent', remaining === 0);
});
