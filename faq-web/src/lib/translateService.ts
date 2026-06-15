export const supportedLanguages = [
  { code: "en", label: "English" },
  { code: "hi", label: "Hindi" },
  { code: "mr", label: "Marathi" },
  { code: "kn", label: "Kannada" },
];

const languageCodes: Record<string, string> = {
  en: "en",
  hi: "hi",
  mr: "mr",
  kn: "kn",
};

const CACHE_KEY = "samagamaTranslationCache";
const MAX_BATCH_LENGTH = 3200;

function getCache() {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function setCache(cache: Record<string, string>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // ignore write failures
  }
}

function parseGoogleResponse(data: unknown) {
  if (!Array.isArray(data) || !Array.isArray(data[0])) return null;
  return data[0].map((segment: any) => segment[0]).join("");
}

export async function translateText(text: string, targetLanguage: string) {
  if (targetLanguage === "en" || !languageCodes[targetLanguage]) {
    return text;
  }

  const cache = getCache();
  const cacheKey = `${targetLanguage}:${text}`;
  if (cache[cacheKey]) {
    return cache[cacheKey];
  }

  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${languageCodes[targetLanguage]}&dt=t&q=${encodeURIComponent(
      text,
    )}`;
    const response = await fetch(url);
    const data = await response.json();
    const translated = parseGoogleResponse(data);

    if (translated) {
      cache[cacheKey] = translated;
      setCache(cache);
      return translated;
    }
  } catch (error) {
    console.warn("Translation request failed:", error);
  }

  return text;
}

function batchFaqs<T extends { question: string; answer: string }>(faqs: T[]) {
  const batches: T[][] = [];
  let batch: T[] = [];
  let length = 0;

  for (const faq of faqs) {
    const item = `${faq.question}\n\n<<<SPLIT>>>\n\n${faq.answer}`;
    if (batch.length > 0 && length + item.length > MAX_BATCH_LENGTH) {
      batches.push(batch);
      batch = [];
      length = 0;
    }
    batch.push(faq);
    length += item.length;
  }

  if (batch.length > 0) batches.push(batch);
  return batches;
}

export async function translateFaqs<T extends { question: string; answer: string }>(
  faqs: T[],
  targetLanguage: string,
) {
  if (targetLanguage === "en" || faqs.length === 0) {
    return faqs;
  }

  const delimiter = "\n\n<<<SPLIT>>>\n\n";
  const faqDelimiter = "\n\n<<<FAQ>>>\n\n";
  const batches = batchFaqs(faqs);
  const translatedFaqs: T[] = [];

  for (const batch of batches) {
    const combined = batch
      .map((faq) => `${faq.question}${delimiter}${faq.answer}`)
      .join(faqDelimiter);

    const translatedCombined = await translateText(combined, targetLanguage);
    const items = translatedCombined.split(faqDelimiter);

    for (let i = 0; i < batch.length; i += 1) {
      const [translatedQuestion, translatedAnswer] = items[i]?.split(delimiter) ?? [];
      translatedFaqs.push({
        ...batch[i],
        question: translatedQuestion || batch[i].question,
        answer: translatedAnswer || batch[i].answer,
      });
    }
  }

  return translatedFaqs;
}
