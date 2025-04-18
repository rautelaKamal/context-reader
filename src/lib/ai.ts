import { HfInference } from '@huggingface/inference';

const hf = new HfInference(process.env.HUGGING_FACE_API_KEY);

export async function getExplanation(text: string): Promise<string> {
  try {
    if (!process.env.HUGGING_FACE_API_KEY) {
      throw new Error('HUGGING_FACE_API_KEY is not set');
    }

    // Using T5 model for better explanations
    const prompt = `Context: The following is a piece of text that needs to be explained in simple terms.

Text: "${text}"

Provide a simple and clear explanation that:
- Explains what this means in everyday language
- Highlights why it matters
- Gives a real-world example if relevant

Keep the tone conversational and friendly, like explaining to a friend. Focus on helping the reader understand the key point.`;
    
    const response = await hf.textGeneration({
      model: 'google/flan-t5-large',
      inputs: prompt,
      parameters: {
        max_length: 200,
        min_length: 50,
        temperature: 0.3,
        top_p: 0.8,
        do_sample: true,
        no_repeat_ngram_size: 2,
        repetition_penalty: 1.5
      }
    });

    // Clean up the response
    const explanation = response.generated_text
      .trim()
      .replace(/^Explanation:\s*/i, '')  // Remove any "Explanation:" prefix
      .replace(/\n{2,}/g, '\n')          // Replace multiple newlines with single
      .replace(/\s{2,}/g, ' ');          // Replace multiple spaces with single

    return explanation;
  } catch (error) {
    console.error('Error in getExplanation:', error);
    throw error;
  }
}

export async function getTranslation(text: string): Promise<string> {
  try {
    if (!process.env.HUGGING_FACE_API_KEY) {
      throw new Error('HUGGING_FACE_API_KEY is not set');
    }

    const response = await hf.translation({
      model: 'Helsinki-NLP/opus-mt-ru-en',
      inputs: text
    });

    return `Translation: "${response.translation_text}"\n\nOriginal text: "${text}"`;
  } catch (error) {
    console.error('Error in getTranslation:', error);
    throw error;
  }
}
