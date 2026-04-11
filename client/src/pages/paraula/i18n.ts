// ─────────────────────────────────────────────────────────────────────────────
// PARAULA – i18n Translations
// ─────────────────────────────────────────────────────────────────────────────

export type ParaulaLang = "ca" | "es" | "en";

export interface ParaulaStrings {
  // App
  appName: string;
  appTagline: string;
  // How to play
  howToPlay: string;
  howToPlayDesc: string;
  howToPlayRule1: string;
  howToPlayRule2: string;
  howToPlayRule3: string;
  howToPlayRule4: string;
  exampleCorrect: string;
  examplePresent: string;
  exampleAbsent: string;
  exampleCorrectDesc: string;
  examplePresentDesc: string;
  exampleAbsentDesc: string;
  // Game messages
  notInList: string;
  tooShort: string;
  youWon: string;
  youLost: string;
  theWordWas: string;
  nextWordIn: string;
  // Stats
  statistics: string;
  played: string;
  winPct: string;
  currentStreak: string;
  maxStreak: string;
  guessDistribution: string;
  shareResult: string;
  copied: string;
  // Settings
  settings: string;
  hardMode: string;
  hardModeDesc: string;
  darkTheme: string;
  language: string;
  languageGame: string;
  languageGameDesc: string;
  // Keyboard
  enter: string;
  delete: string;
  // Misc
  newGame: string;
  close: string;
  day: string;
}

const CA: ParaulaStrings = {
  appName: "PARAULA",
  appTagline: "Endevina la paraula del dia",
  howToPlay: "Com jugar",
  howToPlayDesc: "Endevina la PARAULA en 6 intents.",
  howToPlayRule1: "Cada intent ha de ser una paraula de 5 lletres vàlida.",
  howToPlayRule2: "Prem ENTER per enviar l'intent.",
  howToPlayRule3: "El color de les lletres canviarà per mostrar com d'a prop estàs.",
  howToPlayRule4: "Els accents s'ignoren a l'hora d'introduir paraules.",
  exampleCorrect: "La lletra és correcta i en el lloc correcte.",
  examplePresent: "La lletra és a la paraula però en un altre lloc.",
  exampleAbsent: "La lletra no és a la paraula.",
  exampleCorrectDesc: "La lletra P és en el lloc correcte.",
  examplePresentDesc: "La lletra T és a la paraula però en un altre lloc.",
  exampleAbsentDesc: "La lletra C no és a la paraula.",
  notInList: "Paraula no trobada al diccionari",
  tooShort: "Massa curta! Cal una paraula de 5 lletres",
  youWon: "Enhorabona! 🎉",
  youLost: "Llàstima! La paraula era:",
  theWordWas: "La paraula era:",
  nextWordIn: "Propera paraula en:",
  statistics: "Estadístiques",
  played: "Jugades",
  winPct: "% Victòries",
  currentStreak: "Ratxa actual",
  maxStreak: "Millor ratxa",
  guessDistribution: "Distribució d'intents",
  shareResult: "Compartir",
  copied: "Copiat al porta-retalls! 📋",
  settings: "Configuració",
  hardMode: "Mode difícil",
  hardModeDesc: "Les lletres revelades s'han d'usar en els intents posteriors",
  darkTheme: "Tema fosc",
  language: "Idioma de la interfície",
  languageGame: "Idioma del joc",
  languageGameDesc: "Canvia l'idioma de les paraules del joc",
  enter: "ENTER",
  delete: "⌫",
  newGame: "Nova partida",
  close: "Tancar",
  day: "Dia",
};

const ES: ParaulaStrings = {
  appName: "PARAULA",
  appTagline: "Adivina la palabra del día",
  howToPlay: "Cómo jugar",
  howToPlayDesc: "Adivina la PARAULA en 6 intentos.",
  howToPlayRule1: "Cada intento debe ser una palabra válida de 5 letras.",
  howToPlayRule2: "Pulsa ENTER para enviar el intento.",
  howToPlayRule3: "El color de las letras cambiará para mostrar lo cerca que estás.",
  howToPlayRule4: "Los acentos se ignoran al introducir palabras.",
  exampleCorrect: "La letra está en la posición correcta.",
  examplePresent: "La letra está en la palabra pero en otro lugar.",
  exampleAbsent: "La letra no está en la palabra.",
  exampleCorrectDesc: "La letra P está en la posición correcta.",
  examplePresentDesc: "La letra T está en la palabra pero en otro lugar.",
  exampleAbsentDesc: "La letra C no está en la palabra.",
  notInList: "Palabra no encontrada en el diccionario",
  tooShort: "¡Demasiado corta! Se necesita una palabra de 5 letras",
  youWon: "¡Enhorabuena! 🎉",
  youLost: "¡Lástima! La palabra era:",
  theWordWas: "La palabra era:",
  nextWordIn: "Próxima palabra en:",
  statistics: "Estadísticas",
  played: "Jugadas",
  winPct: "% Victorias",
  currentStreak: "Racha actual",
  maxStreak: "Mejor racha",
  guessDistribution: "Distribución de intentos",
  shareResult: "Compartir",
  copied: "¡Copiado al portapapeles! 📋",
  settings: "Configuración",
  hardMode: "Modo difícil",
  hardModeDesc: "Las letras reveladas deben usarse en los intentos posteriores",
  darkTheme: "Tema oscuro",
  language: "Idioma de la interfaz",
  languageGame: "Idioma del juego",
  languageGameDesc: "Cambia el idioma de las palabras del juego",
  enter: "ENTER",
  delete: "⌫",
  newGame: "Nueva partida",
  close: "Cerrar",
  day: "Día",
};

const EN: ParaulaStrings = {
  appName: "PARAULA",
  appTagline: "Guess the word of the day",
  howToPlay: "How to play",
  howToPlayDesc: "Guess the PARAULA in 6 tries.",
  howToPlayRule1: "Each guess must be a valid 5-letter word.",
  howToPlayRule2: "Press ENTER to submit your guess.",
  howToPlayRule3: "The colour of the tiles will change to show how close you are.",
  howToPlayRule4: "Accents are ignored when entering words.",
  exampleCorrect: "The letter is in the correct position.",
  examplePresent: "The letter is in the word but in the wrong position.",
  exampleAbsent: "The letter is not in the word.",
  exampleCorrectDesc: "The letter P is in the correct position.",
  examplePresentDesc: "The letter T is in the word but in the wrong position.",
  exampleAbsentDesc: "The letter C is not in the word.",
  notInList: "Word not in dictionary",
  tooShort: "Too short! Need a 5-letter word",
  youWon: "Congratulations! 🎉",
  youLost: "Unlucky! The word was:",
  theWordWas: "The word was:",
  nextWordIn: "Next word in:",
  statistics: "Statistics",
  played: "Played",
  winPct: "Win %",
  currentStreak: "Current streak",
  maxStreak: "Max streak",
  guessDistribution: "Guess distribution",
  shareResult: "Share",
  copied: "Copied to clipboard! 📋",
  settings: "Settings",
  hardMode: "Hard mode",
  hardModeDesc: "Revealed letters must be used in subsequent guesses",
  darkTheme: "Dark theme",
  language: "Interface language",
  languageGame: "Game language",
  languageGameDesc: "Change the language of the game words",
  enter: "ENTER",
  delete: "⌫",
  newGame: "New game",
  close: "Close",
  day: "Day",
};

export const TRANSLATIONS: Record<ParaulaLang, ParaulaStrings> = { ca: CA, es: ES, en: EN };

export function useParaulaT(lang: ParaulaLang) {
  return TRANSLATIONS[lang];
}
