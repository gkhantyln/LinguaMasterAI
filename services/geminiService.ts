import { GoogleGenAI, Modality, Content } from "@google/genai";
import { AppSettings, LessonMode, PracticeResult } from "../types";
import { SYSTEM_DEFINITION } from "../constants";
import { decodeBase64, decodeAudioData } from "../utils/audioUtils";

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  console.error("API_KEY ortam değişkenlerinde eksik.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY || '' });

let history: Content[] = [];

export const resetHistory = () => {
  history = [];
};

export const sendMessageToGemini = async (
  input: string | { audioBase64: string, mimeType: string },
  settings: AppSettings
): Promise<{ text: string, translation?: string, hints?: string }> => {
  try {
    const personaInstruction = SYSTEM_DEFINITION.personas[settings.tutorPersona];
    
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

    const systemInstruction = `
${JSON.stringify(SYSTEM_DEFINITION)}

CURRENT SESSION CONTEXT:
- Target Language: ${settings.targetLanguage}
- User Level: ${settings.proficiencyLevel}
- Tutor Persona: ${settings.tutorPersona} (${personaInstruction})
- Session Mode: ${settings.lessonMode.toUpperCase()} (${modeInstruction})
- Focus Topic / Scenario: ${settings.focusTopic || "General Conversation"}

INSTRUCTION:
Act as the defined Tutor Persona (or Character in Roleplay).
Communicate primarily in ${settings.targetLanguage}.
Follow this correction policy: ${correctionRule}.
Adhere strictly to the Session Mode rules.

IF SESSION MODE IS ROLEPLAY:
- You must act out the "AI Role" defined in the Focus Topic.
- Treat the User as the "User Role".
- Start or continue the scenario naturally.
- Do NOT act like a teacher unless the user breaks character to ask for help.

REMEMBER THE 3-PART FORMAT: Response ||| Translation ||| Hints
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

            TASK: Provide 5 NEW and DIFFERENT example answers the student can use to reply to this specific question.
            They must be directly relevant to the question asked.

            STRICT OUTPUT FORMAT (Do not include Structure or Vocabulary, ONLY the Examples list):
            **Examples:**
            1. (Positive) [Sentence] ([TR Translation])
            2. (Negative) [Sentence] ([TR Translation])
            3. (Question) [Sentence] ([TR Translation])
            4. (Formal) [Sentence] ([TR Translation])
            5. (Slang) [Sentence] ([TR Translation])
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
        // Gemini likes reasonable context sizes. 
        // We will send a prompt to categorize the list.
        // If the list is too long, the caller should chunk it, but for simplicity here we assume < 100 words per call or handle it here.
        
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

export const generateSpeechFromText = async (
  text: string,
  settings: AppSettings,
  audioContext: AudioContext,
  isTranslation: boolean = false
): Promise<AudioBuffer | null> => {
  try {
    // Eğer çeviri ise sabit Puck (daha nötr), değilse ayarlardaki ses.
    // Eğer ayarda ses yoksa varsayılan Puck.
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