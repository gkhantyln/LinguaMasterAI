
import { GoogleGenAI, Modality, Content, Type } from "@google/genai";
import { AppSettings, LessonMode, PracticeResult, GameMode, GameQuestion, StoryGenre, StoryState } from "../types";
import { SYSTEM_DEFINITION } from "../constants";
import { decodeBase64, decodeAudioData } from "../utils/audioUtils";

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  console.error("API_KEY ortam değişkenlerinde eksik.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY || '' });

let history: Content[] = [];

// Story History needs to be separate or managed within the component
let storyHistory: Content[] = [];

export const resetHistory = () => {
  history = [];
};

export const resetStoryHistory = () => {
    storyHistory = [];
};

export const sendMessageToGemini = async (
  input: string | { audioBase64: string, mimeType: string },
  settings: AppSettings
): Promise<{ text: string, translation?: string, hints?: string }> => {
  try {
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

    const modelId = "gemini-3-flash-preview";

    const config: any = {
      systemInstruction: systemInstruction,
      temperature: settings.lessonMode === LessonMode.Drill ? 0.4 : 0.8, 
    };

    // Prepare User Content
    let userContentParts: any[] = [];

    if (typeof input === 'string') {
        userContentParts.push({ text: input });
    } else {
        // Audio Input
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

    // Parse Text, Translation and Hints
    const parts = rawText.split('|||');
    const mainText = parts[0].trim();
    const translationText = parts.length > 1 ? parts[1].trim() : undefined;
    const hintsText = parts.length > 2 ? parts[2].trim() : undefined;

    // History'ye sadece ana metni veya raw hali ekleyebiliriz.
    // Modelin kafası karışmasın diye raw halini (separatorlü) ekliyoruz ki formatı unutmamasın.
    history.push({ role: 'model', parts: [{ text: rawText }] });

    return {
        text: mainText,
        translation: translationText,
        hints: hintsText
    };

  } catch (error) {
    console.error("Content generation error:", error);
    throw error;
  }
};

export const regenerateExampleAnswers = async (
    tutorQuestion: string,
    settings: AppSettings
): Promise<string> => {
    try {
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
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
    } catch (error) {
        console.error("Regenerate examples error:", error);
        return "";
    }
};

// --- NEW: Categorize Words Batch ---
export const categorizeWordsBatch = async (
    words: string[],
    targetLanguage: string
): Promise<Record<string, string>> => {
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

// --- NEW: Get Word Details (Translation + Definition) ---
export const getWordDetails = async (
    word: string,
    targetLanguage: string
): Promise<{ translation: string, definition: string }> => {
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

// --- NEW FUNCTION: Evaluate Vocabulary Practice ---
export const evaluateVocabularyPractice = async (
    targetWord: string,
    userSentence: string,
    targetLanguage: string
): Promise<PracticeResult> => {
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
        // Clean markdown code blocks if present
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

// --- STORY MODE GENERATION ---
export const generateInteractiveStory = async (
    genre: StoryGenre,
    settings: AppSettings,
    userChoice: string | null = null,
    isStart: boolean = true
): Promise<StoryState> => {
    try {
        const level = settings.proficiencyLevel;
        const targetLang = settings.targetLanguage;
        const nativeLang = settings.nativeLanguage;

        // Push User Choice to history if continuing
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

        // If starting, clear history
        if (isStart) storyHistory = [];

        // Add prompt to history (conceptually, though for gemini-api we usually send the whole history)
        // Here we just send the new prompt with context if we want to be stateless, 
        // BUT for a story we need context.
        
        // Actually, for GenerateContent with history, we construct the array.
        // Let's create a temporary history array including the system prompt for this specific turn
        const currentTurnContents = [...storyHistory, { role: 'user', parts: [{ text: prompt }] }];

        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: currentTurnContents,
            config: {
                responseMimeType: "application/json"
            }
        });

        const jsonStr = response.text || "{}";
        const cleanJson = jsonStr.replace(/```json/g, '').replace(/```/g, '').trim();
        const result: StoryState = JSON.parse(cleanJson);

        // Append Model Response to History so next turn remembers
        storyHistory.push({ role: 'user', parts: [{ text: prompt }] }); // We store the prompt we sent as user 'intent' or just the raw prompt
        // Better: Push the actual interaction. 
        // If isStart:
        if (isStart) {
             storyHistory = [
                 { role: 'user', parts: [{ text: `Start a ${genre} story in ${targetLang}.` }] },
                 { role: 'model', parts: [{ text: result.narrative }] }
             ];
        } else {
             // We already pushed user choice above. Now push model narrative.
             storyHistory.push({ role: 'model', parts: [{ text: result.narrative }] });
        }

        return result;

    } catch (error) {
        console.error("Story generation failed", error);
        return {
            title: "Error",
            narrative: "Something went wrong generating the story. Please try again.",
            choices: [],
            isEnding: true
        };
    }
};


// --- GAME CONTENT GENERATION ---
export const generateGameContent = async (
    words: string[],
    mode: GameMode,
    targetLanguage: string
): Promise<GameQuestion[]> => {
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
  try {
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

  } catch (error) {
    console.error("Speech generation error:", error);
    return null;
  }
};

export const getTranslationForLive = async (
    originalText: string,
    audioContext: AudioContext
): Promise<AudioBuffer | null> => {
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
    try {
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: `The tutor just said: "${originalText}" in ${targetLanguage}.
            
            Provide helpful hints for the student to reply.
            YOU MUST USE THIS FORMAT EXACTLY:
            
            **Structure:** [Grammar Formula] ([TR Explanation])
            **Vocabulary:** [Word] ([TR]), [Word] ([TR])
            **Examples:**
            1. (Positive) [Sentence] ([TR Translation])
            2. (Negative) [Sentence] ([TR Translation])
            3. (Question) [Sentence] ([TR Translation])
            4. (Formal) [Sentence] ([TR Translation])
            5. (Slang) [Sentence] ([TR Translation])
            `
        });
        return response.text || "İpucu oluşturulamadı.";
    } catch (e) {
        console.error("Hints generation failed", e);
        return "Bağlantı hatası nedeniyle ipucu alınamadı.";
    }
};
