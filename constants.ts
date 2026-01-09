
import { StoryGenre, BadgeDefinition, Quest } from './types';

export const SYSTEM_DEFINITION = {
  "system_name": "LinguaMaster AI",
  "role": "World-Class Language Tutor",
  "mission": "To help the user achieve fluency through natural, adaptive, and correction-based conversation.",
  "core_rules": [
    "ALWAYS respond in the Target Language selected by the user.",
    "Adjust vocabulary and speaking speed based on the User's Proficiency Level.",
    "Provide the response in the Target Language first.",
    "CRITICAL OUTPUT FORMAT: Use the separator '|||' to split your response into 3 parts.",
    "Part 1: Your main response/question in Target Language.",
    "Part 2: The NATIVE LANGUAGE (User's Native Lang) translation of Part 1.",
    "Part 3: STRUCTURED HINTS. You MUST use the following format exactly:",
    "**Structure:** [Grammar Formula like 'Subject + Verb + Object'] ([Brief Native Lang Explanation])",
    "**Vocabulary:** [Word1] ([Native]), [Word2] ([Native])",
    "**Examples:**",
    "1. (Positive) [Sentence] ([Native Translation])",
    "2. (Negative) [Sentence] ([Native Translation])",
    "3. (Question) [Sentence] ([Native Translation])",
    "4. (Formal) [Sentence] ([Native Translation])",
    "5. (Slang) [Sentence] ([Native Translation])"
  ],
  "modes": {
    "conversation": "Engage in a natural, flowing dialogue. Ask follow-up questions related to the user's answers.",
    "drill": "Ask rapid-fire questions about the focus topic. Do not chat. Ask a question, wait for answer, correct if wrong, then ask the next question immediately.",
    "roleplay": "IMMERSE into the defined Scenario. Act EXACTLY as the assigned character (e.g., Waiter, Interviewer). Do not break character. React naturally to the user. Do not be a teacher, be the character."
  },
  "speaking_styles": {
    "standard": "Use clear, grammatically correct, standard language. Neutral tone.",
    "formal": "Use sophisticated vocabulary, polite honorifics, and complex sentence structures. Avoid contractions.",
    "casual": "Use everyday language, common contractions, and a relaxed tone. Like friends talking.",
    "street_slang": "Use modern slang, idioms, phrasal verbs, and informal contractions (e.g., 'gonna', 'wanna', 'ain't'). Be very cool and expressive. Mimic native street talk."
  },
  "correction_policy": {
    "A1-A2": "Only correct major errors that block understanding. Be very encouraging.",
    "B1-B2": "Correct repeated grammar mistakes and offer better vocabulary alternatives.",
    "C1-C2": "Be strict. Correct accent, nuance, and style. Focus on native-like fluency."
  },
  "personas": {
    "strict_professor": "Formal tone, focuses on grammar precision, corrects every mistake immediately.",
    "friendly_local": "Casual tone, uses slang/idioms, focuses on flow and connection over perfect grammar.",
    "business_coach": "Professional tone, focuses on formal negotiation, presentation, and interview skills.",
    "encouraging_friend": "Very patient, high pitch, uses simple words, celebrates every small success."
  }
};

export const SUGGESTED_TOPICS = [
  "Daily Routine 📅",
  "Movies & TV Series 🎬",
  "Future Plans 🔮",
  "Childhood Memories 🧸",
  "Favorite Books 📚",
  "Technology & AI 🤖",
  "Travel Experiences 🌍",
  "Cooking & Food 🍳",
  "Music & Concerts 🎵",
  "Sports & Health 🏃"
];

export const ROLEPLAY_SCENARIOS = [
  "☕ Cafe: Barista (AI) & Customer (User)",
  "✈️ Airport: Check-in Agent (AI) & Traveler (User)",
  "🏥 Doctor: Doctor (AI) & Patient (User)",
  "💼 Job Interview: Manager (AI) & Candidate (User)",
  "🛍️ Shopping: Shop Assistant (AI) & Customer (User)",
  "🚕 Taxi: Driver (AI) & Passenger (User)",
  "🏨 Hotel: Receptionist (AI) & Guest (User)",
  "🏠 Real Estate: Agent (AI) & Home Buyer (User)",
  "👮 Customs: Officer (AI) & Traveler (User)",
  "🍽️ Restaurant: Waiter (AI) & Customer (User)"
];

export const VOICE_OPTIONS = [
  { id: 'Puck', label: 'Puck - Erkek (Enerjik & Doğal)', gender: 'Male' },
  { id: 'Charon', label: 'Charon - Erkek (Derin & Otoriter)', gender: 'Male' },
  { id: 'Fenrir', label: 'Fenrir - Erkek (Tok & Profesyonel)', gender: 'Male' },
  { id: 'Kore', label: 'Kore - Kadın (Sakin & Yatıştırıcı)', gender: 'Female' },
  { id: 'Aoede', label: 'Aoede - Kadın (Klasik & Dengeli)', gender: 'Female' },
];

export const AVAILABLE_TEXT_MODELS = [
    { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash (Tavsiye Edilen)', limit: 'Yüksek Hız, Düşük Maliyet', desc: 'Genel sohbet için en dengeli model.' },
    { id: 'gemini-3-pro-preview', name: 'Gemini 3 Pro', limit: '2 RPM / 32k TPM', desc: 'Daha karmaşık mantık ve dil bilgisi.' },
    { id: 'gemini-2.0-flash-lite-preview', name: 'Gemini 2.0 Flash Lite', limit: 'Çok Yüksek Hız', desc: 'En hızlı ve hafif model.' },
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro (Legacy)', limit: 'Standart', desc: 'Kararlı sürüm.' }
];

export const AVAILABLE_AUDIO_MODELS = [
    { id: 'gemini-2.5-flash-native-audio-preview-12-2025', name: 'Gemini 2.5 Flash Audio', limit: 'Audio Optimize', desc: 'Düşük gecikmeli sesli konuşma için optimize edilmiş.' },
];

export const STORY_GENRE_OPTIONS = [
    { id: StoryGenre.Mystery, label: "Gizem & Dedektif", icon: "Search" },
    { id: StoryGenre.SciFi, label: "Bilim Kurgu", icon: "Rocket" },
    { id: StoryGenre.Fantasy, label: "Fantastik & Büyü", icon: "Wand" },
    { id: StoryGenre.Travel, label: "Macera & Seyahat", icon: "Map" },
    { id: StoryGenre.Survival, label: "Hayatta Kalma", icon: "Tent" },
    { id: StoryGenre.Romance, label: "Romantik Drama", icon: "Heart" },
    { id: StoryGenre.Horror, label: "Gerilim & Korku", icon: "Ghost" },
    { id: StoryGenre.History, label: "Tarihi Kurgu", icon: "Scroll" }
];

// --- GAMIFICATION CONSTANTS ---

export const BADGE_DEFINITIONS: BadgeDefinition[] = [
    { id: 'first_hello', name: 'Merhaba!', description: 'İlk mesajını gönder.', icon: 'Hand', conditionType: 'totalMessages', threshold: 1 },
    { id: 'chatterbox_bronze', name: 'Çaylak Konuşmacı', description: '25 mesaj gönder.', icon: 'MessageSquare', conditionType: 'totalMessages', threshold: 25 },
    { id: 'chatterbox_gold', name: 'Usta Hatip', description: '100 mesaj gönder.', icon: 'MessageCircle', conditionType: 'totalMessages', threshold: 100 },
    
    { id: 'vocab_hunter', name: 'Kelime Avcısı', description: '20 kelime kaydet.', icon: 'Book', conditionType: 'vocabularyCount', threshold: 20 },
    { id: 'vocab_master', name: 'Sözlük Gibi', description: '100 kelime kaydet.', icon: 'Library', conditionType: 'vocabularyCount', threshold: 100 },
    
    { id: 'session_starter', name: 'Ders Başı', description: 'İlk oturumu tamamla.', icon: 'PlayCircle', conditionType: 'sessionsCompleted', threshold: 1 },
    { id: 'dedicated_student', name: 'Azimli Öğrenci', description: '10 oturum tamamla.', icon: 'GraduationCap', conditionType: 'sessionsCompleted', threshold: 10 },
    
    { id: 'story_traveler', name: 'Hayalperest', description: 'İlk hikayeni bitir.', icon: 'Feather', conditionType: 'storiesCompleted', threshold: 1 },
    
    { id: 'streak_week', name: 'Haftalık Seri', description: '7 gün üst üste çalış.', icon: 'Flame', conditionType: 'currentStreak', threshold: 7 },
    
    { id: 'gamer_pro', name: 'Oyun Ustası', description: 'Oyunlarda 500 puan topla.', icon: 'Trophy', conditionType: 'totalGamePoints', threshold: 500 }
];

export const DAILY_QUEST_TEMPLATES: Omit<Quest, 'progress' | 'isCompleted'>[] = [
    { id: 'q_msg_5', description: 'Bugün 5 mesaj gönder.', target: 5, type: 'message', xpReward: 50 },
    { id: 'q_msg_10', description: 'Bugün 10 mesaj gönder.', target: 10, type: 'message', xpReward: 100 },
    { id: 'q_vocab_3', description: '3 yeni kelime kaydet.', target: 3, type: 'vocab', xpReward: 50 },
    { id: 'q_session_1', description: '1 Canlı Ders veya Hikaye tamamla.', target: 1, type: 'session', xpReward: 150 },
    { id: 'q_game_100', description: 'Oyunlarda 100 puan topla.', target: 100, type: 'game_points', xpReward: 75 }
];
