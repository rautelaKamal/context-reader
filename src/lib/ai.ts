import { HfInference } from '@huggingface/inference';

const hf = new HfInference(process.env.HUGGING_FACE_API_KEY);

export async function getExplanation(text: string): Promise<string> {
  try {
    if (!process.env.HUGGING_FACE_API_KEY) {
      throw new Error('HUGGING_FACE_API_KEY is not set');
    }

    // Using T5 model for better explanations
    const prompt = `Please explain this in simple terms and add relevant details:\n\n${text}\n\nExplanation:`;
    
    const response = await hf.textGeneration({
      model: 'google/flan-t5-large',
      inputs: prompt,
      parameters: {
        max_length: 200,
        min_length: 50,
        temperature: 0.3,
        do_sample: true,
        no_repeat_ngram_size: 3
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
      model: 'Helsinki-NLP/opus-mt-fr-en',
      inputs: text
    });

    return `Translation: "${response.translation_text}"\n\nOriginal text: "${text}"`;
  } catch (error) {
    console.error('Error in getTranslation:', error);
    throw error;
  }
}
