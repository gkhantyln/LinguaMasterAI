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
}

export interface AppSettings {
  targetLanguage: TargetLanguage;
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
  targetLanguage: TargetLanguage.English,
  proficiencyLevel: ProficiencyLevel.Beginner, // Varsayılan A1-A2 yapıldı
  tutorPersona: TutorPersona.FriendlyLocal,
  lessonMode: LessonMode.Conversation,
  focusTopic: '',
  voiceOutput: true,
  speechSpeed: 1.0,
  visualizerStyle: VisualizerStyle.Orb,
  voiceName: 'Puck', // Varsayılan ses
};

export const DEFAULT_STATS: UserStats = {
  totalMessages: 0,
  totalErrorsFixed: 0,
  vocabularyCount: 0,
  sessionsCompleted: 0,
  practiceScoreTotal: 0,
  wordsPracticed: 0
};