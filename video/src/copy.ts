/**
 * Every word that appears on screen, per language. The product's own text (the
 * pill, the card, the explanations) is never here: it comes from the extension
 * source or from content/demo-outputs.json, and stays in English in both cuts.
 */
export type Lang = 'en' | 'hi';

export const COPY = {
  en: {
    hook: ['You know every word.', 'So why is this so hard?'],
    struggle: ['Read it again.', 'And again.'],
    aha: ['Just select it.'],
    answer: ['What the writer actually means.'],
    any: ['Poems.', 'Papers.', 'Policy.', 'Anything.'],
    trust: ['Free.', 'No sign-up.', 'We never keep what you read.'],
    addOn: 'A free Chrome add-on',
    cta: "Add to Chrome. It's free.",
    search: 'Search “ContextReader” on the Chrome Web Store',
  },
  hi: {
    hook: ['Har word pata hai.', 'Phir bhi samajh nahi aaya?'],
    struggle: ['Dobara padho.', 'Phir se.'],
    aha: ['Bas select karo.'],
    answer: ['Writer ka asli matlab.'],
    any: ['Poems.', 'Papers.', 'Policy.', 'Kuch bhi.'],
    trust: ['Free.', 'Sign-up nahi.', 'Jo padho, hum nahi rakhte.'],
    addOn: 'Ek free Chrome add-on',
    cta: 'Chrome mein add karo. Free hai.',
    search: 'Chrome Web Store par “ContextReader” search karo',
  },
} satisfies Record<Lang, Record<string, string | string[]>>;
