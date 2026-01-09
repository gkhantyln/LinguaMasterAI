
export enum TargetLanguage {
  English = 'English',
  Spanish = 'Spanish',
  German = 'German',
  French = 'French',
  Italian = 'Italian',
  Japanese = 'Japanese',
  Korean = 'Korean',
  Chinese = 'Chinese (Mandarin)',
  Russian = 'Russian',
  Portuguese = 'Portuguese',
  Arabic = 'Arabic',
  Turkish = 'Turkish',
  Dutch = 'Dutch',
  Swedish = 'Swedish',
  Norwegian = 'Norwegian',
  Danish = 'Danish',
  Finnish = 'Finnish',
  Polish = 'Polish',
  Greek = 'Greek',
  Hindi = 'Hindi',
  Thai = 'Thai',
  Indonesian = 'Indonesian',
  Vietnamese = 'Vietnamese',
  Czech = 'Czech',
  Hungarian = 'Hungarian',
  Romanian = 'Romanian',
  Ukrainian = 'Ukrainian',
  Hebrew = 'Hebrew',
  Persian = 'Persian'
}

export enum NativeLanguage {
    Turkish = 'Turkish',
    English = 'English',
    Spanish = 'Spanish',
    German = 'German',
    French = 'French',
    Japanese = 'Japanese',
    Korean = 'Korean',
    Russian = 'Russian',
    Arabic = 'Arabic'
}

export enum EnglishDialect {
    American = 'American (US)',
    British = 'British (UK)',
    Australian = 'Australian',
    Canadian = 'Canadian'
}

export enum SpeakingStyle {
    Standard = 'standard', // Standart, düzgün
    Formal = 'formal', // Resmi, akademik
    Casual = 'casual', // Günlük, rahat
    StreetSlang = 'street_slang' // Sokak ağzı, argo, havalı
}

export enum ProficiencyLevel {
  Beginner = 'A1-A2 (Beginner)',
  Intermediate = 'B1-B2 (Intermediate)',
  Advanced = 'C1-C2 (Advanced)'
}

export const CEFR_MAP: Record<string, string> = {
    'A1': 'Başlangıç',
    'A2': 'Temel',
    'B1': 'Orta',
    'B2': 'İyi Orta',
    'C1': 'İleri',
    'C2': 'Uzman'
};

export enum TutorPersona {
  StrictProfessor = 'strict_professor',
  FriendlyLocal = 'friendly_local',
  BusinessCoach = 'business_coach',
  EncouragingFriend = 'encouraging_friend'
}

export enum VisualizerStyle {
  Orb = 'orb',
  Waveform = 'waveform'
}

export enum LessonMode {
  Conversation = 'conversation', // Serbest konuşma
  Drill = 'drill', // Soru - Cevap pratiği
  Roleplay = 'roleplay' // Karşılıklı Diyalog / Rol Yapma
}

// --- GAME TYPES ---
export enum GameMode {
    Matching = 'matching', // Eşleştirme
    Cloze = 'cloze', // Boşluk Doldurma
    Scramble = 'scramble', // Cümle Kurma
    Quiz = 'quiz', // Kelime Testi
    Listening = 'listening', // NEW: Dinleme
    Speaking = 'speaking' // NEW: Konuşma (Telaffuz)
}

// --- STORY TYPES (NEW) ---
export enum StoryGenre {
    Mystery = 'Mystery & Detective',
    SciFi = 'Science Fiction',
    Fantasy = 'Fantasy & Magic',
    Travel = 'Travel & Adventure',
    Romance = 'Romance & Drama',
    Horror = 'Thriller & Horror',
    History = 'Historical Fiction',
    Survival = 'Survival'
}

export interface StoryState {
    title: string;
    narrative: string; // The current story text
    narrativeTranslation?: string; // Turkish translation
    choices: string[]; // Options for the user
    imagePrompt?: string; // For generating scene images later
    isEnding: boolean; // Is this the end of the story?
}

export interface GameQuestion {
    id: string;
    type: GameMode;
    // Matching Data
    pair?: { word: string; translation: string };
    // Cloze Data
    questionText?: string; // Sentence with ____
    correctAnswer?: string;
    options?: string[];
    // Scramble Data
    scrambledParts?: string[];
    correctSentence?: string;
    // Quiz/Listening/Speaking Data
    word?: string; // The target word
    correctMeaning?: string; // The correct translation or definition
    wrongMeanings?: string[]; // Distractors (or wrong words for Listening)
    // Hint Data (Universal)
    sentenceTranslation?: string; // Turkish translation of the sentence (for Scramble/Cloze hints)
    hintText?: string; // Generic hint text
}

export interface VocabularyItem {
  id: string;
  word: string; // Kelime veya kısa öbek
  translation: string; // Anlamı
  context: string; // Hangi cümlede geçtiği
  timestamp: number;
}

export interface CustomWord {
    id: string;
    word: string;
    level?: string; // A1, B2 vs.
    category?: string; // Business, Travel, Food etc.
    source?: string; // Oxford 3000, User List vs.
}

export interface PracticeResult {
    isCorrect: boolean;
    feedback: string;
    betterSentence?: string;
    score: number; // 0-100
}

// --- SESSION HISTORY (NEW) ---
export interface SessionRecord {
    id: string;
    date: number; // Timestamp
    durationSeconds: number;
    summary: string; // First few lines or generated summary
    fullTranscript: string; // For context resumption
    language: TargetLanguage;
}

// --- SENTENCE PATTERNS (NEW) ---
export interface DailyPattern {
    id: string;
    pattern: string; // e.g. "I'm thinking of + V-ing"
    meaning: string; // e.g. "...yapmayı düşünüyorum"
    explanation: string; // Short usage explanation
    exampleSentence: string;
    exampleTranslation: string;
    level: string; // A1, B1 etc.
}

// --- GAMIFICATION TYPES ---
export interface Quest {
    id: string;
    description: string;
    target: number;
    progress: number;
    isCompleted: boolean;
    type: 'message' | 'session' | 'vocab' | 'game_points';
    xpReward: number;
}

export interface BadgeDefinition {
    id: string;
    name: string;
    description: string;
    icon: string;
    conditionType: 'totalMessages' | 'vocabularyCount' | 'sessionsCompleted' | 'storiesCompleted' | 'currentStreak' | 'totalGamePoints';
    threshold: number;
}

export interface DailyStat {
    date: string; // YYYY-MM-DD
    messageCount: number;
    wordsLearned: number;
    minutesSpent: number; // Tahmini süre
}

export interface UserStats {
  totalMessages: number;
  totalErrorsFixed: number;
  vocabularyCount: number;
  sessionsCompleted: number;
  practiceScoreTotal: number;
  wordsPracticed: number;
  totalGamePoints: number;
  storiesCompleted: number;
  
  // Gamification
  currentStreak: number;
  maxStreak: number;
  lastLoginDate: string; // YYYY-MM-DD
  badges: string[]; // Unlocked badge IDs
  dailyQuests: Quest[];
  lastQuestDate: string; // YYYY-MM-DD
  level: number;
  currentXP: number;

  // Analytics
  dailyActivity: DailyStat[]; // NEW
}

export interface AppSettings {
  nativeLanguage: NativeLanguage; // NEW
  targetLanguage: TargetLanguage;
  englishDialect: EnglishDialect; // NEW (Relevant only if Target is English)
  speakingStyle: SpeakingStyle; // NEW
  proficiencyLevel: ProficiencyLevel;
  tutorPersona: TutorPersona;
  lessonMode: LessonMode; 
  
  focusTopic: string;
  
  voiceOutput: boolean;
  speechSpeed: number; // 0.5 - 1.5
  visualizerStyle: VisualizerStyle;
  
  voiceName: string; // Seçilen sesin adı (Puck, Kore, vb.)

  // API & Models
  apiKeys: string[]; // User added keys
  textModel: string; // Selected Gemini Model ID for Chat
  audioModel: string; // Selected Gemini Model ID for Live/TTS
}

export interface Message {
  id: string;
  role: 'user' | 'model' | 'system';
  text: string;
  translation?: string;
  hints?: string;
  timestamp: number;
  isError?: boolean;
  audioData?: AudioBuffer;
  isPlaying?: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  nativeLanguage: NativeLanguage.Turkish,
  targetLanguage: TargetLanguage.English,
  englishDialect: EnglishDialect.American,
  speakingStyle: SpeakingStyle.Standard,
  proficiencyLevel: ProficiencyLevel.Beginner,
  tutorPersona: TutorPersona.FriendlyLocal,
  lessonMode: LessonMode.Conversation,
  focusTopic: '',
  voiceOutput: true,
  speechSpeed: 1.0,
  visualizerStyle: VisualizerStyle.Orb,
  voiceName: 'Puck',
  
  apiKeys: [],
  textModel: 'gemini-3-flash-preview',
  audioModel: 'gemini-2.5-flash-native-audio-preview-12-2025'
};

export const DEFAULT_STATS: UserStats = {
  totalMessages: 0,
  totalErrorsFixed: 0,
  vocabularyCount: 0,
  sessionsCompleted: 0,
  practiceScoreTotal: 0,
  wordsPracticed: 0,
  totalGamePoints: 0,
  storiesCompleted: 0,
  
  currentStreak: 0,
  maxStreak: 0,
  lastLoginDate: '',
  badges: [],
  dailyQuests: [],
  lastQuestDate: '',
  level: 1,
  currentXP: 0,
  
  dailyActivity: [] // NEW
};
