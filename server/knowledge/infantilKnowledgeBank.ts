/**
 * Educació Infantil Knowledge Bank — Decree 21/2023 (Catalonia) / LOMLOE
 * Stage: 0–6 years, two cycles: primer cicle (0–3) and segon cicle (3–6)
 * Framework: 4 Eixos de Desenvolupament i Aprenentatge
 */

export type InfantilCycle = "0-3" | "3-6";
export type EixCode = "EIX1" | "EIX2" | "EIX3" | "EIX4";

export interface InfantilQuestion {
  id: string;
  eix: EixCode;
  cycle: InfantilCycle;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface EixMeta {
  code: EixCode;
  name: string;
  emoji: string;
  description: string;
  catalan: string;
}

export const EIX_META: Record<EixCode, EixMeta> = {
  EIX1: {
    code: "EIX1",
    name: "Growing with Autonomy & Confidence",
    catalan: "Un infant que creix amb autonomia i confiança",
    emoji: "🌱",
    description:
      "Body awareness, movement, self-care, emotional wellbeing, and the progressive construction of a positive self-image. Children develop autonomy in everyday routines and learn to trust their own capabilities.",
  },
  EIX2: {
    code: "EIX2",
    name: "Communicating with Different Languages",
    catalan: "Un infant que es comunica amb diferents llenguatges",
    emoji: "🗣️",
    description:
      "Oral and written language, mathematical language, artistic and creative expression, body language, and digital literacy. Children explore multiple ways of expressing and communicating ideas, emotions, and experiences.",
  },
  EIX3: {
    code: "EIX3",
    name: "Discovering the Environment with Curiosity",
    catalan: "Un infant que descobreix l'entorn amb curiositat",
    emoji: "🔍",
    description:
      "Mathematical thinking, scientific inquiry, exploration of the natural world, logical reasoning, and the development of habits of sustainability and care for the environment.",
  },
  EIX4: {
    code: "EIX4",
    name: "Being Part of a Diverse World",
    catalan: "Un infant que forma part de la diversitat del món",
    emoji: "🌍",
    description:
      "Social relationships, cultural diversity, democratic values, community belonging, gender equality, and appreciation of the social and cultural environment. Children build their identity through respectful relationships with others.",
  },
};

export const INFANTIL_QUESTIONS: InfantilQuestion[] = [
  // ─── EIX 1 · Cycle 0–3 ───────────────────────────────────────────────────
  {
    id: "ei001",
    eix: "EIX1",
    cycle: "0-3",
    question:
      "In the 0–3 cycle, which activity best supports a child's sensorimotor development according to Decree 21/2023?",
    options: [
      "Sitting quietly and listening to a teacher lecture",
      "Free movement and autonomous play with varied objects",
      "Completing structured written exercises",
      "Watching educational videos for extended periods",
    ],
    correctIndex: 1,
    explanation:
      "Decree 21/2023 places free movement and autonomous play at the heart of the 0–3 cycle. Sensorimotor exploration — touching, grasping, crawling, and manipulating objects — is the primary vehicle through which infants build body awareness, coordination, and cognitive schemas.",
  },
  {
    id: "ei002",
    eix: "EIX1",
    cycle: "0-3",
    question:
      "What does 'Cos, moviment i autonomia' (Body, movement and autonomy) refer to in the primer cicle?",
    options: [
      "Formal physical education classes with structured exercises",
      "The progressive discovery of the body, its possibilities, and self-care habits",
      "Learning to write and draw using fine motor skills only",
      "Following adult instructions for daily routines without deviation",
    ],
    correctIndex: 1,
    explanation:
      "'Cos, moviment i autonomia' is the knowledge area within Eix 1 for the 0–3 cycle. It encompasses the child's exploration of their own body and its capabilities, the development of sensorimotor skills, and the gradual acquisition of self-care habits — all in a context of wellbeing and enjoyment.",
  },
  // ─── EIX 1 · Cycle 3–6 ───────────────────────────────────────────────────
  {
    id: "ei003",
    eix: "EIX1",
    cycle: "3-6",
    question:
      "According to Decree 21/2023, how should a 3–6 year-old child's self-image be developed in the classroom?",
    options: [
      "By comparing children's abilities to identify the most capable",
      "Through competitive games that reward the fastest learners",
      "By creating contexts that foster a positive, respectful view of one's own body and those of others",
      "By focusing exclusively on academic achievement",
    ],
    correctIndex: 2,
    explanation:
      "Eix 1 for the 3–6 cycle emphasises the construction of a positive self-image and respect for one's own body and the bodies of others. The curriculum explicitly rejects comparison and competition, instead promoting inclusive, respectful environments where every child feels valued.",
  },
  {
    id: "ei004",
    eix: "EIX1",
    cycle: "3-6",
    question:
      "Which of the following is a key saber (knowledge element) within Eix 1 for the segon cicle (3–6)?",
    options: [
      "Memorising the names of all bones in the human body",
      "Developing strategies to identify and avoid situations of risk or danger",
      "Learning to read a thermometer independently",
      "Completing obstacle courses within a set time limit",
    ],
    correctIndex: 1,
    explanation:
      "One of the explicit sabers in Eix 1 for the 3–6 cycle is the progressive development of strategies to identify and avoid risky or dangerous situations. This reflects the curriculum's emphasis on safety awareness as part of growing autonomy and self-confidence.",
  },
  // ─── EIX 2 · Cycle 0–3 ───────────────────────────────────────────────────
  {
    id: "ei005",
    eix: "EIX2",
    cycle: "0-3",
    question:
      "In the 0–3 cycle, which form of communication is most central to Eix 2 (Communicating with different languages)?",
    options: [
      "Written language and formal reading",
      "Gestural, bodily, and oral communication",
      "Digital coding and programming",
      "Mathematical notation and number writing",
    ],
    correctIndex: 1,
    explanation:
      "For the 0–3 cycle, Eix 2 prioritises gestural, bodily, and oral communication as the foundational languages. Infants communicate through movement, facial expression, vocalisation, and gesture long before they access written or formal language. The curriculum values all these forms equally.",
  },
  {
    id: "ei006",
    eix: "EIX2",
    cycle: "0-3",
    question:
      "How does Decree 21/2023 recommend introducing children aged 0–3 to the written language?",
    options: [
      "Through formal handwriting lessons starting at 18 months",
      "By drilling letter recognition with flashcards daily",
      "Through contact with books, images, and environmental print in meaningful contexts",
      "By requiring children to copy words from the board",
    ],
    correctIndex: 2,
    explanation:
      "The decree recommends an emergent literacy approach for 0–3 year-olds: exposure to books, images, and environmental print in natural, meaningful contexts. This builds awareness of written language as a communication system without imposing formal instruction before children are developmentally ready.",
  },
  // ─── EIX 2 · Cycle 3–6 ───────────────────────────────────────────────────
  {
    id: "ei007",
    eix: "EIX2",
    cycle: "3-6",
    question:
      "What is 'emergent writing' (escriptura emergent) in the context of the 3–6 cycle under Decree 21/2023?",
    options: [
      "Copying sentences written by the teacher on the board",
      "Children's spontaneous attempts to represent meaning through marks, symbols, and invented spelling",
      "Formal handwriting practice with ruled lines",
      "Typing on a keyboard using a word processor",
    ],
    correctIndex: 1,
    explanation:
      "Emergent writing refers to children's own spontaneous attempts to communicate through marks, drawings, symbols, and invented spelling — before conventional writing is mastered. Decree 21/2023 treats this as a valid and important stage in literacy development that should be encouraged and celebrated.",
  },
  {
    id: "ei008",
    eix: "EIX2",
    cycle: "3-6",
    question:
      "Which digital literacy goal is appropriate for children in the 3–6 cycle according to Decree 21/2023?",
    options: [
      "Creating complex spreadsheets and databases",
      "Programming robots using advanced coding languages",
      "Initiating use of basic digital tools for exploration and communication",
      "Managing social media accounts independently",
    ],
    correctIndex: 2,
    explanation:
      "Eix 2 for the 3–6 cycle includes digital initiation: exploring basic digital tools (tablets, cameras, simple apps) for communication and creative expression. The goal is curiosity and exploration, not technical mastery — consistent with the child-centred philosophy of Decree 21/2023.",
  },
  // ─── EIX 3 · Cycle 0–3 ───────────────────────────────────────────────────
  {
    id: "ei009",
    eix: "EIX3",
    cycle: "0-3",
    question:
      "How do infants aged 0–3 begin to develop mathematical thinking according to Eix 3 of Decree 21/2023?",
    options: [
      "By memorising number sequences up to 100",
      "Through exploring the properties of objects (shape, colour, size, texture) in everyday situations",
      "By completing formal addition and subtraction worksheets",
      "Through timed mental arithmetic exercises",
    ],
    correctIndex: 1,
    explanation:
      "Mathematical thinking in the 0–3 cycle begins through sensory exploration of objects — their shape, colour, size, weight, and texture. This hands-on discovery of properties lays the cognitive foundation for later classification, comparison, and numerical understanding.",
  },
  {
    id: "ei010",
    eix: "EIX3",
    cycle: "0-3",
    question:
      "What does Decree 21/2023 identify as the primary vehicle for scientific discovery in the 0–3 cycle?",
    options: [
      "Structured laboratory experiments with safety equipment",
      "The child's own actions on objects and the observation of their effects",
      "Watching nature documentaries on a screen",
      "Listening to the teacher explain scientific concepts",
    ],
    correctIndex: 1,
    explanation:
      "For infants, scientific inquiry is rooted in action: dropping, pouring, pushing, pulling, and observing what happens. Decree 21/2023 identifies the child's own actions on the environment and the discovery of cause-and-effect relationships as the foundation of scientific thinking in the 0–3 cycle.",
  },
  // ─── EIX 3 · Cycle 3–6 ───────────────────────────────────────────────────
  {
    id: "ei011",
    eix: "EIX3",
    cycle: "3-6",
    question:
      "Which activity best reflects the Eix 3 competency 'Indagació en el medi natural' (Inquiry into the natural environment) for 3–6 year-olds?",
    options: [
      "Colouring printed pictures of plants and animals",
      "Experimenting with water, soil, and air to discover their properties and behaviours",
      "Memorising the names of 20 different animal species",
      "Watching a teacher demonstrate a science experiment without participating",
    ],
    correctIndex: 1,
    explanation:
      "Eix 3 for the 3–6 cycle includes the saber 'Experimentació amb elements naturals (aigua, terra i aire)' — hands-on experimentation with natural materials. This inquiry-based approach develops curiosity, observation skills, and the beginnings of scientific reasoning.",
  },
  {
    id: "ei012",
    eix: "EIX3",
    cycle: "3-6",
    question:
      "How does Decree 21/2023 connect mathematical learning to sustainability in the 3–6 cycle?",
    options: [
      "By teaching children to calculate carbon footprints",
      "Through using measurement and data collection tools to explore and care for the natural environment",
      "By requiring children to memorise environmental statistics",
      "Through formal geometry lessons about recycling symbols",
    ],
    correctIndex: 1,
    explanation:
      "Eix 3 integrates mathematical tools (measurement, data collection with analogue and digital instruments) with environmental inquiry. Children use these tools to explore nature and begin developing habits of sustainability and respect for the natural world — connecting STEM thinking with civic values.",
  },
  // ─── EIX 4 · Cycle 0–3 ───────────────────────────────────────────────────
  {
    id: "ei013",
    eix: "EIX4",
    cycle: "0-3",
    question:
      "According to Decree 21/2023, what is the primary social group for a child in the 0–3 cycle?",
    options: [
      "The peer group at school",
      "The local community and neighbourhood",
      "The family as the central nucleus of coexistence",
      "The national cultural community",
    ],
    correctIndex: 2,
    explanation:
      "Eix 4 for the 0–3 cycle identifies the family as the central nucleus of coexistence. The curriculum recognises diverse family models and sees the gradual transition from the family group to the social group (school, peers) as a key developmental process for infants.",
  },
  {
    id: "ei014",
    eix: "EIX4",
    cycle: "0-3",
    question:
      "How does Decree 21/2023 describe the role of affective bonds in the 0–3 cycle?",
    options: [
      "As a distraction from academic learning that should be minimised",
      "As the foundation for healthy social development and the basis for all future relationships",
      "As relevant only at home, not in the educational setting",
      "As important only for children with special educational needs",
    ],
    correctIndex: 1,
    explanation:
      "The decree explicitly identifies the formation of affective bonds with key adults and peers as foundational for healthy social and emotional development. The first attachments formed in the 0–3 cycle provide the security from which children can explore the world and build future relationships.",
  },
  // ─── EIX 4 · Cycle 3–6 ───────────────────────────────────────────────────
  {
    id: "ei015",
    eix: "EIX4",
    cycle: "3-6",
    question:
      "What does Decree 21/2023 require teachers to do regarding gender stereotypes in the 3–6 cycle?",
    options: [
      "Ignore gender issues as they are not relevant at this age",
      "Separate activities by gender to respect natural differences",
      "Help children identify and reject gender stereotypes in play and their immediate environment",
      "Teach children that gender roles are fixed and culturally important",
    ],
    correctIndex: 2,
    explanation:
      "Eix 4 for the 3–6 cycle explicitly includes the saber 'Identificació i rebuig d'estereotips de gènere en el joc i l'entorn proper amb l'ajuda de l'adult'. Teachers are expected to actively help children recognise and challenge gender stereotypes, promoting equality from the earliest years.",
  },
  {
    id: "ei016",
    eix: "EIX4",
    cycle: "3-6",
    question:
      "How does Decree 21/2023 approach linguistic diversity in the 3–6 classroom?",
    options: [
      "By requiring all children to speak only Catalan at all times",
      "By treating children's home languages as irrelevant to school learning",
      "By recognising linguistic diversity as an enriching reality and fostering interest and respect for all languages",
      "By separating children by language background for instruction",
    ],
    correctIndex: 2,
    explanation:
      "The decree includes 'Coneixement de la realitat lingüística de l'aula i de l'entorn proper' as a key saber. It treats the linguistic diversity of the classroom as a resource, promoting curiosity and respect for all languages while maintaining Catalan as the vehicular language of instruction.",
  },
  // ─── Additional questions for depth ──────────────────────────────────────
  {
    id: "ei017",
    eix: "EIX1",
    cycle: "0-3",
    question:
      "What is the significance of 'joc autònom' (autonomous play) in the 0–3 curriculum under Decree 21/2023?",
    options: [
      "It is considered less valuable than adult-directed activities",
      "It is the primary context for wellbeing, movement exploration, and self-directed learning",
      "It should be limited to 10 minutes per day to maintain structure",
      "It is only appropriate for children over 2 years old",
    ],
    correctIndex: 1,
    explanation:
      "Autonomous play is central to the 0–3 curriculum. The decree identifies 'gaudi i benestar en el moviment lliure i el joc autònom' as a key saber. When children play freely, they develop motor skills, problem-solving, creativity, and emotional regulation — making it the most powerful learning context at this age.",
  },
  {
    id: "ei018",
    eix: "EIX2",
    cycle: "3-6",
    question:
      "Which artistic language is explicitly included in Eix 2 for the 3–6 cycle under Decree 21/2023?",
    options: [
      "Only visual arts (drawing and painting)",
      "Only music",
      "Plastic arts, music, and body expression as interconnected forms of communication",
      "Only digital art created on tablets",
    ],
    correctIndex: 2,
    explanation:
      "Eix 2 for the 3–6 cycle encompasses multiple artistic languages: plastic/visual arts, music, and body expression. The decree treats these as equally valid and interconnected forms of communication and representation, rejecting a hierarchy that privileges verbal language over other expressive modes.",
  },
  {
    id: "ei019",
    eix: "EIX3",
    cycle: "3-6",
    question:
      "What role do analogue and digital instruments play in Eix 3 for the 3–6 cycle?",
    options: [
      "They are banned as distractions from natural exploration",
      "They are used exclusively by the teacher for demonstration",
      "They are tools children use to collect and analyse data during environmental inquiry",
      "They are only introduced in the last term before primary school",
    ],
    correctIndex: 2,
    explanation:
      "Eix 3 for the 3–6 cycle includes 'Ús d'instruments analògics i digitals (lupes, balances i sensors) per a la recollida i l'anàlisi posterior de dades'. Children are expected to use tools like magnifying glasses, scales, and sensors as part of their scientific inquiry — developing both STEM skills and digital competence.",
  },
  {
    id: "ei020",
    eix: "EIX4",
    cycle: "3-6",
    question:
      "How does Decree 21/2023 describe the relationship between cultural traditions and learning in the 3–6 cycle?",
    options: [
      "Cultural traditions are considered private family matters and excluded from school",
      "Only Catalan traditions are relevant to the curriculum",
      "Participation in diverse cultural celebrations and traditions is a key learning experience that builds social and cultural awareness",
      "Cultural traditions are taught only through formal history lessons",
    ],
    correctIndex: 2,
    explanation:
      "Eix 4 includes 'Participació en festes, tradicions, històries o llegendes de l'entorn proper i de Catalunya' as well as knowledge of ethnocultural traditions present in the child's environment. The decree treats cultural participation as a vehicle for building identity, social belonging, and respect for diversity.",
  },
  {
    id: "ei021",
    eix: "EIX1",
    cycle: "3-6",
    question:
      "What does Decree 21/2023 mean by 'construcció progressiva d'una autoimatge positiva' in the 3–6 cycle?",
    options: [
      "Teaching children to always present themselves as happy and successful",
      "Children gradually developing a realistic, accepting, and positive sense of their own identity, abilities, and body",
      "Encouraging children to compare themselves favourably with peers",
      "Focusing on physical appearance and grooming habits",
    ],
    correctIndex: 1,
    explanation:
      "The progressive construction of a positive self-image means children develop a realistic, accepting, and confident sense of who they are — including their body, emotions, and capabilities. This is built through experiences of success, respectful relationships, and an environment that values each child's uniqueness.",
  },
  {
    id: "ei022",
    eix: "EIX2",
    cycle: "0-3",
    question:
      "Why does Decree 21/2023 emphasise listening and comprehension before speaking in the 0–3 cycle?",
    options: [
      "Because infants are not capable of producing any sounds",
      "Because language comprehension develops before expressive language, and receptive skills form the foundation for communication",
      "Because it is easier for teachers to manage quiet classrooms",
      "Because speaking is considered less important than reading",
    ],
    correctIndex: 1,
    explanation:
      "Language acquisition research consistently shows that receptive language (understanding) precedes expressive language (speaking). Decree 21/2023 reflects this by including 'escolta i comprensió de missatges orals simples' as a foundational saber for the 0–3 cycle, before progressing to oral expression.",
  },
  {
    id: "ei023",
    eix: "EIX3",
    cycle: "0-3",
    question:
      "How does Decree 21/2023 describe the infant's relationship with the natural environment in the 0–3 cycle?",
    options: [
      "As something to be observed from a safe distance without touching",
      "As irrelevant until children are old enough to understand ecological concepts",
      "As a space for active discovery through the child's own actions and exploration of cause-and-effect",
      "As a potential hazard that requires constant adult supervision and restriction",
    ],
    correctIndex: 2,
    explanation:
      "Eix 3 for the 0–3 cycle includes 'Descoberta dels efectes de les pròpies accions en el medi natural'. Infants are encouraged to interact with natural materials and environments, discovering through their own actions how the world works — building the foundations of scientific curiosity and environmental respect.",
  },
  {
    id: "ei024",
    eix: "EIX4",
    cycle: "0-3",
    question:
      "What transition does Decree 21/2023 describe as central to social development in the 0–3 cycle?",
    options: [
      "The transition from home language to Catalan",
      "The progressive transition from the family group to the social group",
      "The transition from play-based to academic learning",
      "The transition from individual to competitive activities",
    ],
    correctIndex: 1,
    explanation:
      "Eix 4 for the 0–3 cycle identifies 'Transició progressiva del grup familiar al grup social' as a key saber. As infants enter nursery settings, they gradually expand their social world from the immediate family to include peers and other adults — a process that requires sensitive support from educators.",
  },
];

/** Return all Infantil questions, optionally filtered by eix and/or cycle */
export function getInfantilQuestions(
  eix?: EixCode,
  cycle?: InfantilCycle
): InfantilQuestion[] {
  return INFANTIL_QUESTIONS.filter(
    (q) =>
      (!eix || q.eix === eix) &&
      (!cycle || q.cycle === cycle)
  );
}

/** Return coverage stats for Infantil: questions per eix per cycle */
export function getInfantilCoverageStats(): Record<string, Record<string, number>> {
  const stats: Record<string, Record<string, number>> = {};
  for (const q of INFANTIL_QUESTIONS) {
    if (!stats[q.eix]) stats[q.eix] = {};
    stats[q.eix][q.cycle] = (stats[q.eix][q.cycle] ?? 0) + 1;
  }
  return stats;
}
