document.addEventListener('DOMContentLoaded', function() {
  const testButton = document.getElementById('testApi');
  const resultDiv = document.getElementById('result');
  const textInput = document.getElementById('textInput');

  testButton.addEventListener('click', async function() {
    const text = textInput.value.trim();
    if (!text) {
      resultDiv.textContent = 'Please enter some text to explain';
      return;
    }

    resultDiv.textContent = 'Making API call...';

    try {
      // Log the API call details
      console.log('Making API call to explain:', text);
      
      // Make the API call
      const response = await fetch('https://context-reader.vercel.app/api/explain', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ text })
      });

      console.log('Response status:', response.status);
      
      // Parse the response
      const data = await response.json();
      console.log('Response data:', data);
      
      // Display the result
      if (data.explanation) {
        resultDiv.textContent = data.explanation;
      } else if (data.error) {
        resultDiv.textContent = 'Error: ' + data.error;
      } else {
        resultDiv.textContent = 'Received response but no explanation found';
      }
    } catch (error) {
      console.error('Error making API call:', error);
      resultDiv.textContent = 'Error: ' + (error.message || 'Failed to make API call');
    }
  });
});
