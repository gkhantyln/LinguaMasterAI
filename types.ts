
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

export interface UserStats {
  totalMessages: number;
  totalErrorsFixed: number;
  vocabularyCount: number;
  sessionsCompleted: number;
  practiceScoreTotal: number;
  wordsPracticed: number;
  totalGamePoints?: number; // Added for games
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
};

export const DEFAULT_STATS: UserStats = {
  totalMessages: 0,
  totalErrorsFixed: 0,
  vocabularyCount: 0,
  sessionsCompleted: 0,
  practiceScoreTotal: 0,
  wordsPracticed: 0,
  totalGamePoints: 0
};
