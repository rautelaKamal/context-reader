document.addEventListener('DOMContentLoaded', function() {
  const testButton = document.getElementById('test-api');
  const resultDiv = document.getElementById('result');
  const textInput = document.getElementById('text-input');

  testButton.addEventListener('click', async function() {
    const text = textInput.value.trim();
    if (!text) {
      resultDiv.innerHTML = '<span class="error">Please enter some text</span>';
      return;
    }

    resultDiv.innerHTML = 'Calling API...';
    resultDiv.className = '';

    try {
      // Direct API call to your Vercel deployment
      const response = await fetch('https://context-reader.vercel.app/api/explain', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          text: text,
          url: 'https://example.com'
        })
      });

      console.log('Response status:', response.status);
      
      const data = await response.json();
      console.log('Response data:', data);

      if (response.ok) {
        if (data.explanation) {
          resultDiv.innerHTML = '<span class="success">SUCCESS!</span><br><br>' + data.explanation;
        } else {
          resultDiv.innerHTML = '<span class="error">No explanation in response</span><br><br>' + JSON.stringify(data, null, 2);
        }
      } else {
        resultDiv.innerHTML = '<span class="error">API Error: ' + response.status + '</span><br><br>' + JSON.stringify(data, null, 2);
      }
    } catch (error) {
      console.error('Error calling API:', error);
      resultDiv.innerHTML = '<span class="error">Error: ' + error.message + '</span>';
      resultDiv.className = 'error';
    }
  });
});
