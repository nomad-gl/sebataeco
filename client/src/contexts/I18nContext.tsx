import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export type Lang = "en" | "es" | "ca";

export const translations = {
  en: {
    // NavBar
    nav_home: "Home",
    nav_chat: "AI Chat",
    nav_practice: "Practice",
    nav_progress: "Progress",
    nav_teacher: "Teacher",
    nav_create: "Create Material",
    nav_presentation: "Presentation",
    nav_my_materials: "My Materials",
    nav_challenge: "Class Challenge",
    nav_questions: "Question Library",
    nav_admin: "Admin",
    nav_sign_in: "Sign In",
    nav_sign_out: "Sign Out",

    // Home
    home_badge: "Spain's LOMLOE Curriculum · 8 Competencies",
    home_hero_title: "Your AI Teaching",
    home_hero_accent: "Assistant",
    home_hero_subtitle: "for LOMLOE",
    home_hero_desc: "Practise all eight key competencies defined by Spain's LOMLOE education law. Ask questions, test your knowledge, and get curriculum-aligned explanations — instantly.",
    home_cta_chat: "Start Chatting",
    home_cta_practice: "Practice Questions",
    home_stats_questions: "Questions",
    home_stats_competencies: "Competencies",
    home_stats_year_groups: "Year Groups",
    home_stats_free: "Free",
    home_features_title: "Everything you need to master LOMLOE",
    home_feature_chat_title: "AI Chat Assistant",
    home_feature_chat_desc: "Ask any LOMLOE curriculum question and receive an accurate, competency-aligned answer instantly.",
    home_feature_practice_title: "Practice Mode",
    home_feature_practice_desc: "Test yourself with curriculum-aligned MCQ questions across all 8 competencies and 3 year groups.",
    home_feature_create_title: "Create Materials",
    home_feature_create_desc: "Generate quizzes, crosswords, flashcards, wordsearches, and more — ready to print or download.",
    home_competencies_title: "8 LOMLOE Competencies",

    // Practice
    practice_title: "Practice Mode",
    practice_subtitle: "Test your LOMLOE knowledge with curriculum-aligned questions",
    practice_setup_competency: "Competency",
    practice_setup_year: "Year Group",
    practice_setup_count: "Number of Questions",
    practice_start: "Start Practice",
    practice_question: "Question",
    practice_of: "of",
    practice_correct: "Correct!",
    practice_incorrect: "Incorrect",
    practice_correct_answer: "Correct answer:",
    practice_explanation: "Explanation",
    practice_next: "Next Question",
    practice_finish: "Finish Session",
    practice_done_title: "Session Complete!",
    practice_done_score: "Your Score",
    practice_done_correct: "Correct",
    practice_done_wrong: "Wrong",
    practice_done_pct: "Percentage",
    practice_again: "Practice Again",
    practice_view_progress: "View Progress",

    // Chat
    chat_title: "AI Chat Assistant",
    chat_subtitle: "Ask any LOMLOE curriculum question",
    chat_placeholder: "Ask a LOMLOE curriculum question…",
    chat_send: "Send",
    chat_greeting: "Hello! I'm SEBA AI | TA, your LOMLOE Teaching Assistant. Ask me anything about Spain's curriculum competencies.",
    chat_sign_in: "Sign in to use AI Chat",
    chat_empty_state: "Hello! I'm SEBA AI | TA, your LOMLOE Teaching Assistant. Ask me anything about Spain's 8 curriculum competencies.",

    // Progress
    progress_title: "My Progress",
    progress_subtitle: "Track your practice sessions and competency scores",
    progress_total_sessions: "Total Sessions",
    progress_avg_score: "Avg. Score",
    progress_best_score: "Best Score",
    progress_questions_answered: "Questions Answered",
    progress_by_competency: "Score by Competency",
    progress_recent: "Recent Sessions",
    progress_no_sessions: "No practice sessions yet. Start practising to see your progress!",
    progress_go_practice: "Go to Practice",
    progress_date: "Date",
    progress_competency: "Competency",
    progress_year_group: "Year Group",
    progress_score: "Score",

    // Create
    create_title: "Create Teaching Material",
    create_subtitle: "AI-generated LOMLOE-aligned activities ready to print or download",
    create_topic_label: "Topic / Learning Objective",
    create_topic_placeholder: "e.g. The water cycle and its stages",
    create_competency_label: "LOMLOE Competency (optional)",
    create_year_label: "Year Group",
    create_generate: "Generate",
    create_generating: "Generating…",
    create_activity_quiz: "Quiz",
    create_activity_slides: "Slides",
    create_activity_crossword: "Crossword",
    create_activity_missing: "Missing Words",
    create_activity_wordsearch: "Wordsearch",
    create_activity_flashcards: "Flashcards",

    // My Materials
    my_materials_title: "My Materials",
    my_materials_subtitle: "Your saved teaching materials",
    my_materials_empty: "No materials yet. Create your first one!",
    my_materials_create: "Create Material",
    my_materials_open: "Open",
    my_materials_delete: "Delete",

    // Admin
    admin_title: "Admin Dashboard",
    admin_subtitle: "Knowledge bank statistics and coverage metrics",
    admin_total_questions: "Total Questions",
    admin_competencies: "Competencies",
    admin_year_groups: "Year Groups",
    admin_coverage: "Coverage",
    admin_by_competency: "Questions by Competency",
    admin_competency: "Competency",
    admin_junior: "Junior",
    admin_primary: "Primary",
    admin_secondary: "Secondary",
    admin_total: "Total",

    // Footer
    footer_powered: "Powered by",
    footer_aligned: "LOMLOE Curriculum Aligned",
    footer_rights: "All rights reserved.",

    // Presentation
    presentation_title: "Create a Presentation",
    presentation_subtitle: "AI-generated slide decks aligned to LOMLOE competencies. Click any slide text to edit it.",
    presentation_heading_label: "Presentation Heading",
    presentation_heading_placeholder: "e.g. Introduction to Photosynthesis",
    presentation_topic_label: "Topic / Learning Objective",
    presentation_topic_placeholder: "e.g. How plants convert sunlight into energy",
    presentation_subject_label: "Subject",
    presentation_year_label: "Year Group",
    presentation_competency_label: "LOMLOE Competency (optional)",
    presentation_generate: "Generate Slides",
    presentation_generating: "Generating…",
    presentation_slides_generated: "slides · click any text to edit",
    presentation_gen_quiz: "Generate Quiz",
    presentation_gen_fill: "Fill-in-the-blank",

    // Challenge
    challenge_title: "Class Challenge",
    challenge_subtitle: "Create a live quiz session for your class",
    challenge_room_code: "Room Code",
    challenge_start: "Start Challenge",
    challenge_join: "Join Challenge",
    challenge_enter_code: "Enter room code",
    challenge_join_btn: "Join",
    challenge_leaderboard: "Leaderboard",

    // Question Library
    questions_title: "Question Library",
    questions_subtitle: "Browse all LOMLOE curriculum questions by competency and year group",
    questions_filter_competency: "Filter by competency",
    questions_filter_year: "Filter by year group",
    questions_all: "All",
    questions_correct_answer: "Correct Answer",
    questions_explanation: "Explanation",

    // Practice extra
    practice_check_answer: "Check Answer",
    practice_new_session: "New Session",
    practice_retry: "Retry Same Filters",
    practice_loading_q: "Loading question…",
    practice_questions_per: "questions per session",
    practice_correct_well: "Correct! Well done.",
    practice_not_quite: "Not quite — the correct answer is:",
    practice_perfect: "Perfect score! Excellent work! 🎉",
    practice_great: "Great job! Keep practising to improve further.",
    practice_good_effort: "Good effort! Review the topics and try again.",
    practice_scored: "You scored",

    // Chat extra
    chat_filter: "Filter",
    chat_clear: "Clear",
    chat_context_filtered: "AI context filtered to",
    chat_year_group: "year group",
    chat_error: "I'm sorry, I encountered an error processing your request. Please try again.",
    chat_suggested_1: "What is a rhetorical question and why is it used?",
    chat_suggested_2: "Explain the difference between speed and velocity.",
    chat_suggested_3: "What is code-switching in multilingual communication?",
    chat_suggested_4: "How does machine learning work?",
    chat_suggested_5: "What is metacognition and why does it matter?",
    chat_suggested_6: "Explain the separation of powers in a democracy.",

    // Common
    any_competency: "Any competency",
    any_year: "Any year group",
    sign_in_required: "Sign in required",
    loading: "Loading…",
    error: "Something went wrong",
    save: "Save",
    cancel: "Cancel",
    delete: "Delete",
    open: "Open",
    print: "Print",
    download: "Download",
    word: "Word",
    pdf: "PDF",
    png: "PNG",
  },

  es: {
    // NavBar
    nav_home: "Inicio",
    nav_chat: "Chat IA",
    nav_practice: "Practicar",
    nav_progress: "Progreso",
    nav_teacher: "Docente",
    nav_create: "Crear Material",
    nav_presentation: "Presentación",
    nav_my_materials: "Mis Materiales",
    nav_challenge: "Reto de Clase",
    nav_questions: "Banco de Preguntas",
    nav_admin: "Administración",
    nav_sign_in: "Iniciar sesión",
    nav_sign_out: "Cerrar sesión",

    // Home
    home_badge: "Currículo LOMLOE de España · 8 Competencias",
    home_hero_title: "Tu Asistente de",
    home_hero_accent: "Enseñanza IA",
    home_hero_subtitle: "para LOMLOE",
    home_hero_desc: "Practica las ocho competencias clave definidas por la ley educativa LOMLOE de España. Haz preguntas, pon a prueba tus conocimientos y obtén explicaciones alineadas con el currículo — al instante.",
    home_cta_chat: "Empezar a chatear",
    home_cta_practice: "Practicar preguntas",
    home_stats_questions: "Preguntas",
    home_stats_competencies: "Competencias",
    home_stats_year_groups: "Cursos",
    home_stats_free: "Gratis",
    home_features_title: "Todo lo que necesitas para dominar LOMLOE",
    home_feature_chat_title: "Asistente de Chat IA",
    home_feature_chat_desc: "Haz cualquier pregunta sobre el currículo LOMLOE y recibe una respuesta precisa y alineada con las competencias al instante.",
    home_feature_practice_title: "Modo Práctica",
    home_feature_practice_desc: "Evalúate con preguntas de opción múltiple alineadas con el currículo en las 8 competencias y 3 cursos.",
    home_feature_create_title: "Crear Materiales",
    home_feature_create_desc: "Genera cuestionarios, crucigramas, tarjetas, sopas de letras y más — listos para imprimir o descargar.",
    home_competencies_title: "8 Competencias LOMLOE",

    // Practice
    practice_title: "Modo Práctica",
    practice_subtitle: "Pon a prueba tus conocimientos LOMLOE con preguntas alineadas al currículo",
    practice_setup_competency: "Competencia",
    practice_setup_year: "Curso",
    practice_setup_count: "Número de preguntas",
    practice_start: "Comenzar práctica",
    practice_question: "Pregunta",
    practice_of: "de",
    practice_correct: "¡Correcto!",
    practice_incorrect: "Incorrecto",
    practice_correct_answer: "Respuesta correcta:",
    practice_explanation: "Explicación",
    practice_next: "Siguiente pregunta",
    practice_finish: "Finalizar sesión",
    practice_done_title: "¡Sesión completada!",
    practice_done_score: "Tu puntuación",
    practice_done_correct: "Correctas",
    practice_done_wrong: "Incorrectas",
    practice_done_pct: "Porcentaje",
    practice_again: "Practicar de nuevo",
    practice_view_progress: "Ver progreso",

    // Chat
    chat_title: "Asistente de Chat IA",
    chat_subtitle: "Haz cualquier pregunta sobre el currículo LOMLOE",
    chat_placeholder: "Haz una pregunta sobre el currículo LOMLOE…",
    chat_send: "Enviar",
    chat_greeting: "¡Hola! Soy SEBA AI | TA, tu asistente de enseñanza LOMLOE. Pregúntame cualquier cosa sobre las competencias del currículo español.",
    chat_sign_in: "Inicia sesión para usar el Chat IA",
    chat_empty_state: "¡Hola! Soy SEBA AI | TA, tu asistente de enseñanza LOMLOE. Pregúntame cualquier cosa sobre las 8 competencias del currículo español.",

    // Progress
    progress_title: "Mi Progreso",
    progress_subtitle: "Sigue tus sesiones de práctica y puntuaciones por competencia",
    progress_total_sessions: "Sesiones totales",
    progress_avg_score: "Puntuación media",
    progress_best_score: "Mejor puntuación",
    progress_questions_answered: "Preguntas respondidas",
    progress_by_competency: "Puntuación por competencia",
    progress_recent: "Sesiones recientes",
    progress_no_sessions: "Aún no hay sesiones de práctica. ¡Empieza a practicar para ver tu progreso!",
    progress_go_practice: "Ir a Práctica",
    progress_date: "Fecha",
    progress_competency: "Competencia",
    progress_year_group: "Curso",
    progress_score: "Puntuación",

    // Create
    create_title: "Crear Material Didáctico",
    create_subtitle: "Actividades generadas por IA alineadas con LOMLOE, listas para imprimir o descargar",
    create_topic_label: "Tema / Objetivo de aprendizaje",
    create_topic_placeholder: "p. ej. El ciclo del agua y sus etapas",
    create_competency_label: "Competencia LOMLOE (opcional)",
    create_year_label: "Curso",
    create_generate: "Generar",
    create_generating: "Generando…",
    create_activity_quiz: "Cuestionario",
    create_activity_slides: "Diapositivas",
    create_activity_crossword: "Crucigrama",
    create_activity_missing: "Palabras que faltan",
    create_activity_wordsearch: "Sopa de letras",
    create_activity_flashcards: "Tarjetas",

    // My Materials
    my_materials_title: "Mis Materiales",
    my_materials_subtitle: "Tus materiales didácticos guardados",
    my_materials_empty: "Aún no hay materiales. ¡Crea el primero!",
    my_materials_create: "Crear material",
    my_materials_open: "Abrir",
    my_materials_delete: "Eliminar",

    // Admin
    admin_title: "Panel de Administración",
    admin_subtitle: "Estadísticas del banco de conocimiento y métricas de cobertura",
    admin_total_questions: "Total de preguntas",
    admin_competencies: "Competencias",
    admin_year_groups: "Cursos",
    admin_coverage: "Cobertura",
    admin_by_competency: "Preguntas por competencia",
    admin_competency: "Competencia",
    admin_junior: "Inicial",
    admin_primary: "Primaria",
    admin_secondary: "Secundaria",
    admin_total: "Total",

    // Footer
    footer_powered: "Desarrollado por",
    footer_aligned: "Alineado con el currículo LOMLOE",
    footer_rights: "Todos los derechos reservados.",

    // Presentation
    presentation_title: "Crear una Presentación",
    presentation_subtitle: "Presentaciones generadas por IA alineadas con LOMLOE. Haz clic en cualquier texto para editarlo.",
    presentation_heading_label: "Título de la presentación",
    presentation_heading_placeholder: "p. ej. Introducción a la fotosíntesis",
    presentation_topic_label: "Tema / Objetivo de aprendizaje",
    presentation_topic_placeholder: "p. ej. Cómo las plantas convierten la luz solar en energía",
    presentation_subject_label: "Asignatura",
    presentation_year_label: "Curso",
    presentation_competency_label: "Competencia LOMLOE (opcional)",
    presentation_generate: "Generar diapositivas",
    presentation_generating: "Generando…",
    presentation_slides_generated: "diapositivas · haz clic en cualquier texto para editar",
    presentation_gen_quiz: "Generar cuestionario",
    presentation_gen_fill: "Rellenar huecos",

    // Challenge
    challenge_title: "Reto de Clase",
    challenge_subtitle: "Crea una sesión de cuestionario en vivo para tu clase",
    challenge_room_code: "Código de sala",
    challenge_start: "Iniciar reto",
    challenge_join: "Unirse al reto",
    challenge_enter_code: "Introduce el código de sala",
    challenge_join_btn: "Unirse",
    challenge_leaderboard: "Clasificación",

    // Question Library
    questions_title: "Banco de Preguntas",
    questions_subtitle: "Explora todas las preguntas del currículo LOMLOE por competencia y curso",
    questions_filter_competency: "Filtrar por competencia",
    questions_filter_year: "Filtrar por curso",
    questions_all: "Todas",
    questions_correct_answer: "Respuesta correcta",
    questions_explanation: "Explicación",

    // Practice extra
    practice_check_answer: "Comprobar respuesta",
    practice_new_session: "Nueva sesión",
    practice_retry: "Repetir con los mismos filtros",
    practice_loading_q: "Cargando pregunta…",
    practice_questions_per: "preguntas por sesión",
    practice_correct_well: "¡Correcto! Muy bien.",
    practice_not_quite: "No del todo — la respuesta correcta es:",
    practice_perfect: "¡Puntuación perfecta! ¡Excelente trabajo! 🎉",
    practice_great: "¡Buen trabajo! Sigue practicando para mejorar.",
    practice_good_effort: "¡Buen esfuerzo! Repasa los temas e inténtalo de nuevo.",
    practice_scored: "Has obtenido",

    // Chat extra
    chat_filter: "Filtrar",
    chat_clear: "Limpiar",
    chat_context_filtered: "Contexto IA filtrado a",
    chat_year_group: "curso",
    chat_error: "Lo siento, encontré un error al procesar tu solicitud. Por favor, inténtalo de nuevo.",
    chat_suggested_1: "¿Qué es una pregunta retórica y por qué se usa?",
    chat_suggested_2: "Explica la diferencia entre velocidad y rapidez.",
    chat_suggested_3: "¿Qué es el cambio de código en la comunicación multilingüe?",
    chat_suggested_4: "¿Cómo funciona el aprendizaje automático?",
    chat_suggested_5: "¿Qué es la metacognición y por qué importa?",
    chat_suggested_6: "Explica la separación de poderes en una democracia.",

    // Common
    any_competency: "Cualquier competencia",
    any_year: "Cualquier curso",
    sign_in_required: "Inicio de sesión requerido",
    loading: "Cargando…",
    error: "Algo salió mal",
    save: "Guardar",
    cancel: "Cancelar",
    delete: "Eliminar",
    open: "Abrir",
    print: "Imprimir",
    download: "Descargar",
    word: "Word",
    pdf: "PDF",
    png: "PNG",
  },

  ca: {
    // NavBar
    nav_home: "Inici",
    nav_chat: "Xat IA",
    nav_practice: "Practicar",
    nav_progress: "Progrés",
    nav_teacher: "Docent",
    nav_create: "Crear Material",
    nav_presentation: "Presentació",
    nav_my_materials: "Els Meus Materials",
    nav_challenge: "Repte de Classe",
    nav_questions: "Banc de Preguntes",
    nav_admin: "Administració",
    nav_sign_in: "Iniciar sessió",
    nav_sign_out: "Tancar sessió",

    // Home
    home_badge: "Currículum LOMLOE d'Espanya · 8 Competències",
    home_hero_title: "El Teu Assistent",
    home_hero_accent: "d'Ensenyament IA",
    home_hero_subtitle: "per a LOMLOE",
    home_hero_desc: "Practica les vuit competències clau definides per la llei educativa LOMLOE d'Espanya. Fes preguntes, posa a prova els teus coneixements i obtén explicacions alineades amb el currículum — a l'instant.",
    home_cta_chat: "Comença a xatejar",
    home_cta_practice: "Practicar preguntes",
    home_stats_questions: "Preguntes",
    home_stats_competencies: "Competències",
    home_stats_year_groups: "Cursos",
    home_stats_free: "Gratuït",
    home_features_title: "Tot el que necessites per dominar LOMLOE",
    home_feature_chat_title: "Assistent de Xat IA",
    home_feature_chat_desc: "Fes qualsevol pregunta sobre el currículum LOMLOE i rep una resposta precisa i alineada amb les competències a l'instant.",
    home_feature_practice_title: "Mode Pràctica",
    home_feature_practice_desc: "Avalua't amb preguntes d'opció múltiple alineades amb el currículum en les 8 competències i 3 cursos.",
    home_feature_create_title: "Crear Materials",
    home_feature_create_desc: "Genera qüestionaris, mots encreuats, targetes, sopes de lletres i més — a punt per imprimir o descarregar.",
    home_competencies_title: "8 Competències LOMLOE",

    // Practice
    practice_title: "Mode Pràctica",
    practice_subtitle: "Posa a prova els teus coneixements LOMLOE amb preguntes alineades al currículum",
    practice_setup_competency: "Competència",
    practice_setup_year: "Curs",
    practice_setup_count: "Nombre de preguntes",
    practice_start: "Començar pràctica",
    practice_question: "Pregunta",
    practice_of: "de",
    practice_correct: "Correcte!",
    practice_incorrect: "Incorrecte",
    practice_correct_answer: "Resposta correcta:",
    practice_explanation: "Explicació",
    practice_next: "Pregunta següent",
    practice_finish: "Finalitzar sessió",
    practice_done_title: "Sessió completada!",
    practice_done_score: "La teva puntuació",
    practice_done_correct: "Correctes",
    practice_done_wrong: "Incorrectes",
    practice_done_pct: "Percentatge",
    practice_again: "Practicar de nou",
    practice_view_progress: "Veure progrés",

    // Chat
    chat_title: "Assistent de Xat IA",
    chat_subtitle: "Fes qualsevol pregunta sobre el currículum LOMLOE",
    chat_placeholder: "Fes una pregunta sobre el currículum LOMLOE…",
    chat_send: "Enviar",
    chat_greeting: "Hola! Sóc SEBA AI | TA, el teu assistent d'ensenyament LOMLOE. Pregunta'm qualsevol cosa sobre les competències del currículum espanyol.",
    chat_sign_in: "Inicia sessió per usar el Xat IA",
    chat_empty_state: "Hola! Sóc SEBA AI | TA, el teu assistent d'ensenyament LOMLOE. Pregunta'm qualsevol cosa sobre les 8 competències del currículum espanyol.",

    // Progress
    progress_title: "El Meu Progrés",
    progress_subtitle: "Segueix les teves sessions de pràctica i puntuacions per competència",
    progress_total_sessions: "Sessions totals",
    progress_avg_score: "Puntuació mitjana",
    progress_best_score: "Millor puntuació",
    progress_questions_answered: "Preguntes respostes",
    progress_by_competency: "Puntuació per competència",
    progress_recent: "Sessions recents",
    progress_no_sessions: "Encara no hi ha sessions de pràctica. Comença a practicar per veure el teu progrés!",
    progress_go_practice: "Anar a Pràctica",
    progress_date: "Data",
    progress_competency: "Competència",
    progress_year_group: "Curs",
    progress_score: "Puntuació",

    // Create
    create_title: "Crear Material Didàctic",
    create_subtitle: "Activitats generades per IA alineades amb LOMLOE, a punt per imprimir o descarregar",
    create_topic_label: "Tema / Objectiu d'aprenentatge",
    create_topic_placeholder: "p. ex. El cicle de l'aigua i les seves etapes",
    create_competency_label: "Competència LOMLOE (opcional)",
    create_year_label: "Curs",
    create_generate: "Generar",
    create_generating: "Generant…",
    create_activity_quiz: "Qüestionari",
    create_activity_slides: "Diapositives",
    create_activity_crossword: "Mots encreuats",
    create_activity_missing: "Paraules que falten",
    create_activity_wordsearch: "Sopa de lletres",
    create_activity_flashcards: "Targetes",

    // My Materials
    my_materials_title: "Els Meus Materials",
    my_materials_subtitle: "Els teus materials didàctics desats",
    my_materials_empty: "Encara no hi ha materials. Crea el primer!",
    my_materials_create: "Crear material",
    my_materials_open: "Obrir",
    my_materials_delete: "Eliminar",

    // Admin
    admin_title: "Tauler d'Administració",
    admin_subtitle: "Estadístiques del banc de coneixement i mètriques de cobertura",
    admin_total_questions: "Total de preguntes",
    admin_competencies: "Competències",
    admin_year_groups: "Cursos",
    admin_coverage: "Cobertura",
    admin_by_competency: "Preguntes per competència",
    admin_competency: "Competència",
    admin_junior: "Inicial",
    admin_primary: "Primària",
    admin_secondary: "Secundària",
    admin_total: "Total",

    // Footer
    footer_powered: "Desenvolupat per",
    footer_aligned: "Alineat amb el currículum LOMLOE",
    footer_rights: "Tots els drets reservats.",

    // Presentation
    presentation_title: "Crear una Presentació",
    presentation_subtitle: "Presentacions generades per IA alineades amb LOMLOE. Fes clic en qualsevol text per editar-lo.",
    presentation_heading_label: "Títol de la presentació",
    presentation_heading_placeholder: "p. ex. Introducció a la fotosíntesi",
    presentation_topic_label: "Tema / Objectiu d'aprenentatge",
    presentation_topic_placeholder: "p. ex. Com les plantes converteixen la llum solar en energia",
    presentation_subject_label: "Assignatura",
    presentation_year_label: "Curs",
    presentation_competency_label: "Competència LOMLOE (opcional)",
    presentation_generate: "Generar diapositives",
    presentation_generating: "Generant…",
    presentation_slides_generated: "diapositives · fes clic en qualsevol text per editar",
    presentation_gen_quiz: "Generar qüestionari",
    presentation_gen_fill: "Omplir buits",

    // Challenge
    challenge_title: "Repte de Classe",
    challenge_subtitle: "Crea una sessió de qüestionari en viu per a la teva classe",
    challenge_room_code: "Codi de sala",
    challenge_start: "Iniciar repte",
    challenge_join: "Unir-se al repte",
    challenge_enter_code: "Introdueix el codi de sala",
    challenge_join_btn: "Unir-se",
    challenge_leaderboard: "Classificació",

    // Question Library
    questions_title: "Banc de Preguntes",
    questions_subtitle: "Explora totes les preguntes del currículum LOMLOE per competència i curs",
    questions_filter_competency: "Filtrar per competència",
    questions_filter_year: "Filtrar per curs",
    questions_all: "Totes",
    questions_correct_answer: "Resposta correcta",
    questions_explanation: "Explicació",

    // Practice extra
    practice_check_answer: "Comprovar resposta",
    practice_new_session: "Nova sessió",
    practice_retry: "Repetir amb els mateixos filtres",
    practice_loading_q: "Carregant pregunta…",
    practice_questions_per: "preguntes per sessió",
    practice_correct_well: "Correcte! Molt bé.",
    practice_not_quite: "No del tot — la resposta correcta és:",
    practice_perfect: "Puntuació perfecta! Excel·lent feina! 🎉",
    practice_great: "Bon treball! Continua practicant per millorar.",
    practice_good_effort: "Bon esforç! Repassa els temes i torna-ho a intentar.",
    practice_scored: "Has obtingut",

    // Chat extra
    chat_filter: "Filtrar",
    chat_clear: "Netejar",
    chat_context_filtered: "Context IA filtrat a",
    chat_year_group: "curs",
    chat_error: "Ho sento, he trobat un error en processar la teva sol·licitud. Si us plau, torna-ho a intentar.",
    chat_suggested_1: "Què és una pregunta retòrica i per què s'utilitza?",
    chat_suggested_2: "Explica la diferència entre velocitat i rapidesa.",
    chat_suggested_3: "Què és el canvi de codi en la comunicació multilingüe?",
    chat_suggested_4: "Com funciona l'aprenentatge automàtic?",
    chat_suggested_5: "Què és la metacognició i per què és important?",
    chat_suggested_6: "Explica la separació de poders en una democràcia.",

    // Common
    any_competency: "Qualsevol competència",
    any_year: "Qualsevol curs",
    sign_in_required: "Cal iniciar sessió",
    loading: "Carregant…",
    error: "Alguna cosa ha anat malament",
    save: "Desar",
    cancel: "Cancel·lar",
    delete: "Eliminar",
    open: "Obrir",
    print: "Imprimir",
    download: "Descarregar",
    word: "Word",
    pdf: "PDF",
    png: "PNG",
  },
} as const;

export type TranslationKey = keyof typeof translations.en;

type I18nContextType = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: TranslationKey) => string;
};

const I18nContext = createContext<I18nContextType>({
  lang: "en",
  setLang: () => {},
  t: (key) => key,
});

function detectBrowserLang(): Lang {
  const nav = navigator.language?.toLowerCase() ?? "";
  if (nav.startsWith("ca")) return "ca";
  if (nav.startsWith("es")) return "es";
  return "en";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    const stored = localStorage.getItem("seba_lang") as Lang | null;
    return stored ?? detectBrowserLang();
  });

  const setLang = (l: Lang) => {
    setLangState(l);
    localStorage.setItem("seba_lang", l);
  };

  const t = (key: TranslationKey): string =>
    (translations[lang] as Record<string, string>)[key] ??
    (translations.en as Record<string, string>)[key] ??
    key;

  return (
    <I18nContext.Provider value={{ lang, setLang, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}
