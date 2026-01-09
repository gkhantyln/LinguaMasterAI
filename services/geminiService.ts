
import { GoogleGenAI, Modality, Content, Type } from "@google/genai";
import { AppSettings, LessonMode, PracticeResult, GameMode, GameQuestion, StoryGenre, StoryState, DailyPattern, PlacementQuestion, NewsArticle, WritingFeedback, IdiomCard, ShadowingResult } from "../types";
import { SYSTEM_DEFINITION } from "../constants";
import { decodeBase64, decodeAudioData } from "../utils/audioUtils";

const DEFAULT_API_KEY = process.env.API_KEY;

// --- KEY MANAGER ---
// Manages rotation and fallback of API keys
class KeyManager {
    private currentIndex = 0;

    getKey(settings: AppSettings): string {
        const userKeys = settings.apiKeys || [];
        const allKeys = [...userKeys];
        
        // Add default key if available and not already in list (optional, but good for fallback)
        if (DEFAULT_API_KEY && !allKeys.includes(DEFAULT_API_KEY)) {
            allKeys.push(DEFAULT_API_KEY);
        }

        if (allKeys.length === 0) {
            console.warn("No API Keys available.");
            return '';
        }

        // Ensure index is valid
        if (this.currentIndex >= allKeys.length) {
            this.currentIndex = 0;
        }

        return allKeys[this.currentIndex];
    }

    rotateKey(settings: AppSettings): string {
        const userKeys = settings.apiKeys || [];
        const allKeys = [...userKeys];
        if (DEFAULT_API_KEY && !allKeys.includes(DEFAULT_API_KEY)) {
            allKeys.push(DEFAULT_API_KEY);
        }

        if (allKeys.length <= 1) return this.getKey(settings); // No other keys to rotate to

        this.currentIndex = (this.currentIndex + 1) % allKeys.length;
        console.log(`Switched to API Key index: ${this.currentIndex}`);
        return allKeys[this.currentIndex];
    }
}

const keyManager = new KeyManager();

// Helper to get client with current active key
const getAIClient = (settings: AppSettings) => {
    const key = keyManager.getKey(settings);
    return new GoogleGenAI({ apiKey: key });
};

// Retry wrapper for API calls
async function withRetry<T>(
    operation: (ai: GoogleGenAI) => Promise<T>,
    settings: AppSettings
): Promise<T> {
    const maxRetries = (settings.apiKeys?.length || 0) + 1; // Try once for each key available (roughly)
    let lastError: any;

    for (let i = 0; i < maxRetries; i++) {
        try {
            const ai = getAIClient(settings);
            return await operation(ai);
        } catch (error: any) {
            lastError = error;
            // Check for quota/rate limit errors or 429
            if (error.status === 429 || error.message?.includes('429') || error.message?.includes('quota') || error.message?.includes('resource exhausted')) {
                console.warn(`API Key limit reached (Attempt ${i + 1}). Rotating key...`);
                keyManager.rotateKey(settings);
                continue; 
            }
            // For other errors, throw immediately or retry? Let's throw for non-auth errors
            throw error;
        }
    }
    throw lastError;
}

let history: Content[] = [];
let storyHistory: Content[] = [];
let patternPracticeHistory: Content[] = [];

export const resetHistory = () => { history = []; };
export const resetStoryHistory = () => { storyHistory = []; };
export const resetPatternHistory = () => { patternPracticeHistory = []; };

// --- GET ACTIVE KEY EXPORT ---
// Used by LiveSession to initialize connection
export const getActiveApiKey = (settings: AppSettings): string => {
    return keyManager.getKey(settings);
};

export const sendMessageToGemini = async (
  input: string | { audioBase64: string, mimeType: string },
  settings: AppSettings
): Promise<{ text: string, translation?: string, hints?: string }> => {
  return withRetry(async (ai) => {
    const personaInstruction = SYSTEM_DEFINITION.personas[settings.tutorPersona];
    const styleInstruction = SYSTEM_DEFINITION.speaking_styles[settings.speakingStyle];
    
    let modeInstruction = "";
    if (settings.lessonMode === LessonMode.Drill) {
        modeInstruction = SYSTEM_DEFINITION.modes.drill;
    } else if (settings.lessonMode === LessonMode.Roleplay) {
        modeInstruction = SYSTEM_DEFINITION.modes.roleplay;
    } else {
        modeInstruction = SYSTEM_DEFINITION.modes.conversation;
    }

    const correctionRule = SYSTEM_DEFINITION.correction_policy[
        settings.proficiencyLevel === 'A1-A2 (Beginner)' ? "A1-A2" : 
        settings.proficiencyLevel === 'B1-B2 (Intermediate)' ? "B1-B2" : "C1-C2"
    ];

    const dialectInstruction = settings.targetLanguage === 'English' 
        ? `Use ${settings.englishDialect} spelling, vocabulary, and idioms.` 
        : "";

    const systemInstruction = `
${JSON.stringify(SYSTEM_DEFINITION)}

CURRENT SESSION CONTEXT:
- Target Language: ${settings.targetLanguage}
- Native Language (User): ${settings.nativeLanguage}
- User Level: ${settings.proficiencyLevel}
- Tutor Persona: ${settings.tutorPersona} (${personaInstruction})
- Speaking Style: ${settings.speakingStyle} (${styleInstruction})
- English Dialect: ${dialectInstruction}
- Session Mode: ${settings.lessonMode.toUpperCase()} (${modeInstruction})
- Focus Topic / Scenario: ${settings.focusTopic || "General Conversation"}

INSTRUCTION:
Act as the defined Tutor Persona (or Character in Roleplay).
Communicate primarily in ${settings.targetLanguage}.
Use the defined **Speaking Style** (e.g., if 'street_slang', use slang/informal tone).
Follow this correction policy: ${correctionRule}.
Adhere strictly to the Session Mode rules.

CRITICAL CORRECTION RULE:
If the user makes a grammar mistake, typo, or unnatural phrasing:
1. Start your response EXACTLY with the phrase: "Did you mean: [Corrected Sentence]?"
2. Add a very brief explanation of the mistake in ${settings.nativeLanguage} (e.g. "(Wrong Tense)").
3. Insert a double line break (\n\n).
4. Then, continue with your natural conversational response to what the user intended to say.

IF SESSION MODE IS ROLEPLAY:
- You must act out the "AI Role" defined in the Focus Topic.
- Treat the User as the "User Role".
- Start or continue the scenario naturally.
- Do NOT act like a teacher unless the user breaks character to ask for help.

REMEMBER THE 3-PART FORMAT for the final output: 
[Correction if needed] [Main Response] ||| Translation (in ${settings.nativeLanguage}) ||| Hints (explained in ${settings.nativeLanguage})
`;

    // USE SELECTED MODEL FROM SETTINGS
    const modelId = settings.textModel || "gemini-3-flash-preview";

    const config: any = {
      systemInstruction: systemInstruction,
      temperature: settings.lessonMode === LessonMode.Drill ? 0.4 : 0.8, 
    };

    let userContentParts: any[] = [];

    if (typeof input === 'string') {
        userContentParts.push({ text: input });
    } else {
        userContentParts.push({
            inlineData: {
                mimeType: input.mimeType,
                data: input.audioBase64
            }
        });
        userContentParts.push({ text: "Please listen to my audio and respond." });
    }

    history.push({ role: 'user', parts: userContentParts });

    const response = await ai.models.generateContent({
      model: modelId,
      contents: history,
      config: config
    });

    const rawText = response.text || "I apologize, I could not generate a response.";

    const parts = rawText.split('|||');
    const mainText = parts[0].trim();
    const translationText = parts.length > 1 ? parts[1].trim() : undefined;
    const hintsText = parts.length > 2 ? parts[2].trim() : undefined;

    history.push({ role: 'model', parts: [{ text: rawText }] });

    return {
        text: mainText,
        translation: translationText,
        hints: hintsText
    };
  }, settings);
};

// --- NEW: Generate Daily Patterns ---
export const generateDailyPatterns = async (
    settings: AppSettings
): Promise<DailyPattern[]> => {
    return withRetry(async (ai) => {
        const response = await ai.models.generateContent({
            model: settings.textModel || "gemini-3-flash-preview",
            contents: `
            Task: Generate 5 useful, common sentence patterns or idioms for a language learner.
            Target Language: ${settings.targetLanguage}
            Learner Level: ${settings.proficiencyLevel}
            Native Language: ${settings.nativeLanguage} (for meanings/explanations)
            
            Focus on patterns that are very common in daily conversation but might be tricky for learners.
            
            Output JSON Array Format:
            [
              {
                "id": "1",
                "pattern": "I'm thinking of + V-ing",
                "meaning": "...yapmayı düşünüyorum",
                "explanation": "Used when considering a future action but not 100% decided.",
                "exampleSentence": "I'm thinking of moving to a new city.",
                "exampleTranslation": "Yeni bir şehre taşınmayı düşünüyorum.",
                "level": "A2"
              }
            ]
            `,
            config: {
                responseMimeType: "application/json"
            }
        });

        const jsonStr = response.text || "[]";
        const cleanJson = jsonStr.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(cleanJson);
    }, settings);
};

// --- UPDATED: Send Message to Pattern Practice ---
export const sendMessageToPatternPractice = async (
    userMessage: string,
    targetPattern: DailyPattern,
    settings: AppSettings,
    isStart: boolean = false
): Promise<{ text: string, translation?: string, hints?: string }> => {
    return withRetry(async (ai) => {
        if (isStart) patternPracticeHistory = [];

        const prompt = isStart ? `
            ROLE: Language Practice Partner.
            TASK: Help the user practice the specific sentence pattern: "${targetPattern.pattern}".
            TARGET LANGUAGE: ${settings.targetLanguage}.
            NATIVE LANGUAGE: ${settings.nativeLanguage}.
            USER LEVEL: ${settings.proficiencyLevel}.
            
            CONTEXT: The user wants to learn how to use this pattern in a real dialogue.
            
            INSTRUCTIONS:
            1. Start by asking a question that forces the user to use the pattern "${targetPattern.pattern}" in their answer.
            2. Be friendly and encouraging.
            3. If the user answers using the pattern correctly, praise them and ask a follow-up question using the same or related pattern.
            4. If the user answers INCORRECTLY (grammar or pattern usage), gently correct them (start with "Did you mean: ...") and ask them to try again.
            
            Keep responses short (1-2 sentences).

            IMPORTANT OUTPUT FORMAT:
            Use '|||' to separate the Main Response, Native Translation, and Hints.
            
            Example:
            Great use of the pattern! What else are you thinking of doing? ||| Harika kullandın! Başka ne yapmayı düşünüyorsun? ||| **Structure:** [Explanation]...
        ` : userMessage;

        patternPracticeHistory.push({ role: 'user', parts: [{ text: prompt }] });

        const response = await ai.models.generateContent({
            model: settings.textModel || "gemini-3-flash-preview",
            contents: patternPracticeHistory
        });

        const rawText = response.text || "";
        patternPracticeHistory.push({ role: 'model', parts: [{ text: rawText }] });
        
        const parts = rawText.split('|||');
        return {
            text: parts[0].trim(),
            translation: parts.length > 1 ? parts[1].trim() : undefined,
            hints: parts.length > 2 ? parts[2].trim() : undefined
        };
    }, settings);
};

export const regenerateExampleAnswers = async (
    tutorQuestion: string,
    settings: AppSettings
): Promise<string> => {
    return withRetry(async (ai) => {
        const response = await ai.models.generateContent({
            model: settings.textModel || "gemini-3-flash-preview",
            contents: `
            CONTEXT: The language tutor asked the student: "${tutorQuestion}"
            TARGET LANGUAGE: ${settings.targetLanguage}
            USER LEVEL: ${settings.proficiencyLevel}
            NATIVE LANGUAGE: ${settings.nativeLanguage}

            TASK: Provide 5 NEW and DIFFERENT example answers the student can use to reply to this specific question.
            They must be directly relevant to the question asked.

            STRICT OUTPUT FORMAT (Do not include Structure or Vocabulary, ONLY the Examples list):
            **Examples:**
            1. (Positive) [Sentence] ([Native Lang Translation])
            2. (Negative) [Sentence] ([Native Lang Translation])
            3. (Question) [Sentence] ([Native Lang Translation])
            4. (Formal) [Sentence] ([Native Lang Translation])
            5. (Slang) [Sentence] ([Native Lang Translation])
            `
        });
        return response.text || "";
    }, settings);
};

export const categorizeWordsBatch = async (
    words: string[],
    targetLanguage: string
): Promise<Record<string, string>> => {
    // This is a utility function, we can default to flash
    const ai = new GoogleGenAI({ apiKey: DEFAULT_API_KEY || '' });
    try {
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: `
            TASK: Assign a single, general thematic category to each word in the list below.
            LANGUAGE: ${targetLanguage}
            
            SUGGESTED CATEGORIES (Use these if applicable, or similar simple ones):
            [Business, Academic, Travel, Daily Life, Emotions, Technology, Health, Politics, Nature, Social, Food, Arts, Abstract]
            
            INPUT WORDS:
            ${JSON.stringify(words)}
            
            OUTPUT FORMAT:
            Return ONLY a JSON object mapping the word to its category.
            Example: { "apple": "Food", "run": "Action", "policy": "Politics" }
            `,
            config: {
                responseMimeType: "application/json"
            }
        });

        const jsonStr = response.text || "{}";
        const cleanJson = jsonStr.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(cleanJson);
    } catch (error) {
        console.error("Batch categorization error", error);
        return {};
    }
};

export const getWordDetails = async (
    word: string,
    targetLanguage: string
): Promise<{ translation: string, definition: string }> => {
    // Utility, use default key if possible or passed settings (simplified here)
    const ai = new GoogleGenAI({ apiKey: DEFAULT_API_KEY || '' });
    try {
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: `
            Word: "${word}"
            Language: ${targetLanguage}
            
            Task: Provide the direct translation of this word in Turkish and a short, simple definition in ${targetLanguage}.
            
            Return JSON ONLY:
            {
                "translation": "Turkish translation",
                "definition": "Simple definition in target language"
            }
            `,
            config: {
                responseMimeType: "application/json"
            }
        });

        const jsonStr = response.text || "{}";
        const cleanJson = jsonStr.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(cleanJson);
    } catch (error) {
        console.error("Word details error", error);
        return { translation: "...", definition: "..." };
    }
};

export const evaluateVocabularyPractice = async (
    targetWord: string,
    userSentence: string,
    targetLanguage: string
): Promise<PracticeResult> => {
    const ai = new GoogleGenAI({ apiKey: DEFAULT_API_KEY || '' });
    try {
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: `
            Role: Language Teacher.
            Task: Evaluate the student's sentence based on the required TARGET WORD.
            Target Language: ${targetLanguage}
            
            Target Word: "${targetWord}"
            Student Sentence: "${userSentence}"
            
            Analyze:
            1. Did the student use the target word (or a valid form of it)?
            2. Is the grammar correct?
            3. Does the sentence make logical sense?
            
            Return ONLY a JSON object:
            {
                "isCorrect": boolean, (true if word used AND grammar is mostly correct)
                "score": number, (0-100 based on quality)
                "feedback": "Turkish explanation of mistakes or praise.",
                "betterSentence": "Optional better version of the sentence in target language"
            }
            `,
            config: {
                responseMimeType: "application/json"
            }
        });

        const jsonStr = response.text || "{}";
        const cleanJson = jsonStr.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(cleanJson);

    } catch (error) {
        console.error("Practice evaluation failed", error);
        return {
            isCorrect: false,
            score: 0,
            feedback: "Değerlendirme yapılamadı. Bağlantınızı kontrol edin."
        };
    }
};

export const generateInteractiveStory = async (
    genre: StoryGenre,
    settings: AppSettings,
    userChoice: string | null = null,
    isStart: boolean = true
): Promise<StoryState> => {
    return withRetry(async (ai) => {
        const level = settings.proficiencyLevel;
        const targetLang = settings.targetLanguage;
        const nativeLang = settings.nativeLanguage;

        if (!isStart && userChoice) {
            storyHistory.push({
                role: 'user',
                parts: [{ text: `I choose: ${userChoice}. Continue the story.` }]
            });
        }

        const prompt = isStart ? `
            ROLE: Interactive Fiction Narrator.
            GENRE: ${genre}.
            TARGET LANGUAGE: ${targetLang}.
            USER LEVEL: ${level} (Adjust vocabulary/grammar complexity accordingly).
            
            TASK: Start a new, engaging story where the user is the protagonist (You/Sen).
            
            OUTPUT JSON FORMAT:
            {
                "title": "A catchy title in ${targetLang}",
                "narrative": "The first segment of the story (3-4 sentences max). Engaging and descriptive.",
                "narrativeTranslation": "Full translation in ${nativeLang}",
                "choices": ["Option A in ${targetLang}", "Option B in ${targetLang}", "Option C in ${targetLang}"],
                "imagePrompt": "A detailed visual description of the current scene for an image generator",
                "isEnding": false
            }
        ` : `
            ROLE: Interactive Fiction Narrator.
            TARGET LANGUAGE: ${targetLang}.
            
            TASK: Continue the story based on the user's last choice.
            If the story should end based on the choice, set "isEnding" to true and provide a conclusion.
            Otherwise, provide the next segment and 3 new choices.
            
            OUTPUT JSON FORMAT:
            {
                "title": "Same title as before",
                "narrative": "Next story segment (3-4 sentences).",
                "narrativeTranslation": "Translation in ${nativeLang}",
                "choices": ["Option A", "Option B", "Option C"] (Empty if isEnding is true),
                "imagePrompt": "Visual description of the new scene",
                "isEnding": boolean
            }
        `;

        if (isStart) storyHistory = [];

        const currentTurnContents = [...storyHistory, { role: 'user', parts: [{ text: prompt }] }];

        const response = await ai.models.generateContent({
            model: settings.textModel || "gemini-3-flash-preview",
            contents: currentTurnContents,
            config: {
                responseMimeType: "application/json"
            }
        });

        const jsonStr = response.text || "{}";
        const cleanJson = jsonStr.replace(/```json/g, '').replace(/```/g, '').trim();
        const result: StoryState = JSON.parse(cleanJson);

        storyHistory.push({ role: 'user', parts: [{ text: prompt }] }); 
        if (isStart) {
             storyHistory = [
                 { role: 'user', parts: [{ text: `Start a ${genre} story in ${targetLang}.` }] },
                 { role: 'model', parts: [{ text: result.narrative }] }
             ];
        } else {
             storyHistory.push({ role: 'model', parts: [{ text: result.narrative }] });
        }

        return result;
    }, settings);
};

export const generateGameContent = async (
    words: string[],
    mode: GameMode,
    targetLanguage: string
): Promise<GameQuestion[]> => {
    // Utility, fallback to default key/model for stability
    const ai = new GoogleGenAI({ apiKey: DEFAULT_API_KEY || '' });
    try {
        let prompt = "";
        
        if (mode === GameMode.Matching) {
            prompt = `
            Task: Create a matching game for these words.
            Target Language: ${targetLanguage}
            Words: ${JSON.stringify(words)}
            
            Output: JSON Array of objects.
            Format: [{ "id": "1", "type": "matching", "pair": { "word": "Apple", "translation": "Elma" } }, ...]
            Ensure translations are accurate in Turkish.
            `;
        } else if (mode === GameMode.Cloze) {
            prompt = `
            Task: Create fill-in-the-blank (cloze) questions.
            Target Language: ${targetLanguage}
            Words: ${JSON.stringify(words)}
            
            For each word, create a simple sentence where the word is missing (replaced by _____).
            Provide 3 incorrect options (distractors) that are also words in ${targetLanguage}.
            IMPORTANT: Provide the full TURKISH translation of the sentence for the hint system.
            
            Output: JSON Array.
            Format: 
            [
              {
                "id": "unique_id",
                "type": "cloze",
                "questionText": "I ate a red _____.",
                "correctAnswer": "apple",
                "options": ["apple", "car", "dog", "run"],
                "sentenceTranslation": "Kırmızı bir elma yedim."
              }
            ]
            `;
        } else if (mode === GameMode.Scramble) {
             prompt = `
            Task: Create sentence scramble puzzles.
            Target Language: ${targetLanguage}
            Words: ${JSON.stringify(words)}
            
            For each word, create a correct, simple sentence using that word.
            Then break that sentence into shuffled parts.
            IMPORTANT: Provide the full TURKISH translation of the sentence for the hint system.
            
            Output: JSON Array.
            Format:
            [
              {
                "id": "unique_id",
                "type": "scramble",
                "correctSentence": "I like to eat apples",
                "scrambledParts": ["eat", "apples", "I", "like", "to"],
                "sentenceTranslation": "Elma yemeyi severim."
              }
            ]
            `;
        } else if (mode === GameMode.Quiz) {
             prompt = `
            Task: Create a multiple-choice vocabulary quiz.
            Target Language: ${targetLanguage}
            Words: ${JSON.stringify(words)}
            
            For each word, provide the correct Turkish translation as the answer.
            Provide 3 incorrect Turkish translations as distractors.
            Also provide a simple definition in ${targetLanguage} as a hint.
            
            Output: JSON Array.
            Format:
            [
              {
                "id": "unique_id",
                "type": "quiz",
                "word": "apple",
                "correctMeaning": "Elma",
                "wrongMeanings": ["Araba", "Koşmak", "Masa"],
                "hintText": "A round red fruit."
              }
            ]
            `;
        } else if (mode === GameMode.Listening) {
             prompt = `
            Task: Create a listening identification game.
            Target Language: ${targetLanguage}
            Words: ${JSON.stringify(words)}
            
            For each word, simply return the word itself as the correct answer.
            Provide 3 incorrect words in ${targetLanguage} as options (distractors).
            Also provide a hint which is the Turkish translation.
            
            Output: JSON Array.
            Format:
            [
              {
                "id": "unique_id",
                "type": "listening",
                "word": "apple", 
                "options": ["apple", "car", "run", "blue"],
                "hintText": "Elma"
              }
            ]
            `;
        } else if (mode === GameMode.Speaking) {
             prompt = `
            Task: Create a pronunciation game.
            Target Language: ${targetLanguage}
            Words: ${JSON.stringify(words)}
            
            For each word, return the word itself.
            Provide the IPA phonetic transcription if possible as a hint.
            Provide the Turkish translation as a hint.
            
            Output: JSON Array.
            Format:
            [
              {
                "id": "unique_id",
                "type": "speaking",
                "word": "apple",
                "hintText": "/ˈæp.əl/ (Elma)"
              }
            ]
            `;
        }

        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: prompt,
            config: {
                responseMimeType: "application/json"
            }
        });

        const jsonStr = response.text || "[]";
        const cleanJson = jsonStr.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(cleanJson);

    } catch (error) {
        console.error("Game generation failed", error);
        return [];
    }
}

export const generateSpeechFromText = async (
  text: string,
  settings: AppSettings,
  audioContext: AudioContext,
  isTranslation: boolean = false
): Promise<AudioBuffer | null> => {
  return withRetry(async (ai) => {
    const selectedVoice = isTranslation ? 'Puck' : (settings.voiceName || 'Puck');

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: selectedVoice },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

    if (!base64Audio) {
      console.warn("TTS no data.");
      return null;
    }

    const audioBytes = decodeBase64(base64Audio);
    const audioBuffer = await decodeAudioData(audioBytes, audioContext);
    
    return audioBuffer;
  }, settings);
};

export const getTranslationForLive = async (
    originalText: string,
    audioContext: AudioContext
): Promise<AudioBuffer | null> => {
    // Use default client for simple translation
    const ai = new GoogleGenAI({ apiKey: DEFAULT_API_KEY || '' });
    try {
        const textResponse = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: `Translate the following English text to Turkish exactly. Do not add comments. Text: "${originalText}"`
        });
        const translatedText = textResponse.text?.trim();
        
        if (!translatedText) return null;

        const ttsResponse = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-tts",
            contents: [{ parts: [{ text: translatedText }] }],
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } } 
                }
            }
        });

        const base64Audio = ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (!base64Audio) return null;

        const audioBytes = decodeBase64(base64Audio);
        return await decodeAudioData(audioBytes, audioContext);

    } catch (e) {
        console.error("Translation audio failed", e);
        return null;
    }
};

export const getTextTranslationForLive = async (
    originalText: string
): Promise<string> => {
    const ai = new GoogleGenAI({ apiKey: DEFAULT_API_KEY || '' });
    try {
        const textResponse = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: `Translate the following English text to Turkish exactly. Just return the translated text, no intro/outro. Text: "${originalText}"`
        });
        return textResponse.text?.trim() || "Çeviri yapılamadı.";
    } catch (e) {
        console.error("Text translation failed", e);
        return "Bağlantı hatası.";
    }
};

export const getHintsForLive = async (
    originalText: string,
    targetLanguage: string
): Promise<string> => {
    const ai = new GoogleGenAI({ apiKey: DEFAULT_API_KEY || '' });
    try {
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: `
            Analyze the following sentence spoken by a language tutor:
            "${originalText}"

            Is it a question or something that requires a response from the student?
            Target Language: ${targetLanguage}

            Task:
            1. If it's a question, provide 3 SPECIFIC and NATURAL suggested replies for the student in ${targetLanguage}.
            2. If it's not a question (just a statement), provide 3 relevant follow-up comments or questions the student could ask.
            
            IMPORTANT:
            - Include the Turkish translation for each suggestion in parentheses.
            - Format as a numbered list.
            - Do not include "Structure" or "Vocabulary" sections, just the conversational suggestions.
            
            Example Format:
            1. [Suggested Reply in ${targetLanguage}] ([Turkish Translation])
            2. [Suggested Reply in ${targetLanguage}] ([Turkish Translation])
            3. [Suggested Reply in ${targetLanguage}] ([Turkish Translation])
            `
        });
        return response.text || "Öneri oluşturulamadı.";
    } catch (e) {
        console.error("Hints generation failed", e);
        return "Bağlantı hatası nedeniyle öneri alınamadı.";
    }
};

// --- STUDY HUB SERVICES (NEW) ---

export const generatePlacementTest = async (settings: AppSettings): Promise<PlacementQuestion[]> => {
    return withRetry(async (ai) => {
        const response = await ai.models.generateContent({
            model: settings.textModel || "gemini-3-flash-preview",
            contents: `
            Generate 10 multiple-choice English proficiency questions ranging from A1 to C2.
            The questions should test grammar, vocabulary, and reading comprehension.
            
            Return JSON Array:
            [
              {
                "id": 1,
                "question": "She _____ to the store yesterday.",
                "options": ["go", "went", "gone", "going"],
                "correctIndex": 1,
                "level": "A2"
              }
            ]
            `,
            config: { responseMimeType: "application/json" }
        });
        const jsonStr = response.text?.replace(/```json|```/g, '').trim() || "[]";
        return JSON.parse(jsonStr);
    }, settings);
};

export const evaluateWriting = async (text: string, settings: AppSettings): Promise<WritingFeedback> => {
    return withRetry(async (ai) => {
        const response = await ai.models.generateContent({
            model: settings.textModel || "gemini-3-flash-preview",
            contents: `
            Act as an English writing tutor. Evaluate the following text for grammar, vocabulary (CEFR ${settings.proficiencyLevel}), and flow.
            
            Input Text: "${text}"
            
            Return JSON:
            {
              "correctedText": "The fully corrected version of the text.",
              "score": 85,
              "critique": "A summary of feedback in ${settings.nativeLanguage}.",
              "mistakes": [
                 { "original": "wrong part", "correction": "right part", "explanation": "Why it was wrong (in ${settings.nativeLanguage})" }
              ]
            }
            `,
            config: { responseMimeType: "application/json" }
        });
        const jsonStr = response.text?.replace(/```json|```/g, '').trim() || "{}";
        return JSON.parse(jsonStr);
    }, settings);
};

export const generateNewsArticles = async (settings: AppSettings): Promise<NewsArticle[]> => {
    return withRetry(async (ai) => {
        const response = await ai.models.generateContent({
            model: settings.textModel || "gemini-3-flash-preview",
            contents: `
            Generate 3 short, interesting news summaries (approx 100 words each) suitable for ${settings.proficiencyLevel} English learners.
            Topics: Tech, Science, Culture.
            
            Return JSON Array:
            [
              {
                "id": "news1",
                "title": "Headline",
                "content": "Story text...",
                "translation": "Turkish translation of story...",
                "keywords": [{ "word": "difficult_word", "meaning": "Turkish meaning" }],
                "level": "${settings.proficiencyLevel}"
              }
            ]
            `,
            config: { responseMimeType: "application/json" }
        });
        const jsonStr = response.text?.replace(/```json|```/g, '').trim() || "[]";
        return JSON.parse(jsonStr);
    }, settings);
};

export const generateIdiom = async (settings: AppSettings): Promise<IdiomCard> => {
    return withRetry(async (ai) => {
        const response = await ai.models.generateContent({
            model: settings.textModel || "gemini-3-flash-preview",
            contents: `
            Pick a popular English idiom or slang appropriate for ${settings.proficiencyLevel}.
            
            Return JSON:
            {
              "idiom": "Break a leg",
              "meaning": "Good luck (Turkish meaning)",
              "origin": "Brief origin story in English",
              "example": "Example sentence using the idiom."
            }
            `,
            config: { responseMimeType: "application/json" }
        });
        const jsonStr = response.text?.replace(/```json|```/g, '').trim() || "{}";
        return JSON.parse(jsonStr);
    }, settings);
};

export const evaluateShadowing = async (originalText: string, userTranscript: string, settings: AppSettings): Promise<ShadowingResult> => {
    return withRetry(async (ai) => {
        const response = await ai.models.generateContent({
            model: settings.textModel || "gemini-3-flash-preview",
            contents: `
            Compare the User Transcript to the Original Text for a shadowing exercise.
            Original: "${originalText}"
            User Transcript: "${userTranscript}"
            
            Ignore punctuation case. Focus on missed words or wrong words.
            
            Return JSON:
            {
              "score": 80,
              "feedback": "Feedback on accuracy in ${settings.nativeLanguage}.",
              "transcript": "${userTranscript}"
            }
            `,
            config: { responseMimeType: "application/json" }
        });
        const jsonStr = response.text?.replace(/```json|```/g, '').trim() || "{}";
        return JSON.parse(jsonStr);
    }, settings);
};
