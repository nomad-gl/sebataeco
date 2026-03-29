import { useLocation, Link } from "wouter";
import { ArrowLeft, BookOpen, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import NavBar from "@/components/NavBar";
import { useI18n } from "@/contexts/I18nContext";
import { cn } from "@/lib/utils";

/* ─────────────────────────────────────────────────────────────────────────────
   Full LOMLOE Competency Data
   Source: Real Decreto 157/2022 (Primaria) & Real Decreto 217/2022 (ESO)
───────────────────────────────────────────────────────────────────────────── */
const COMP_COLORS: Record<string, string> = {
  CCL:   "oklch(0.50 0.18 240)",
  CP:    "oklch(0.50 0.18 200)",
  STEM:  "oklch(0.48 0.18 145)",
  CD:    "oklch(0.48 0.20 270)",
  CPSAA:"oklch(0.50 0.18 30)",
  CC:    "oklch(0.48 0.18 350)",
  CE:    "oklch(0.50 0.20 60)",
  CCEC:  "oklch(0.48 0.18 320)",
};

interface CompetencyData {
  code: string;
  name: string;
  emoji: string;
  fullName: string;
  lomloeArticle: string;
  overview: string;
  whyItMatters: string;
  keyDimensions: { title: string; description: string }[];
  descriptors: { level: string; items: string[] }[];
  classroomExamples: string[];
  linkedSubjects: string[];
}

const COMPETENCY_DETAIL: Record<string, CompetencyData> = {
  CCL: {
    code: "CCL",
    name: "Linguistic Communication",
    emoji: "📖",
    fullName: "Competencia en Comunicación Lingüística (CCL)",
    lomloeArticle: "Annex I, LOMLOE — Real Decreto 157/2022 & 217/2022",
    overview:
      "Linguistic Communication competence refers to the ability to use language — spoken and written — as a tool for communication, representation, interpretation, and understanding of reality. It encompasses the ability to express and understand ideas, feelings, facts, and opinions in both oral and written form, and to interact linguistically in an appropriate, creative, and critical manner in a full range of sociocultural and communicative contexts.",
    whyItMatters:
      "Language is the primary medium through which all other learning takes place. Strong linguistic competence enables students to access knowledge across all subjects, participate in democratic life, and develop their personal and professional identities.",
    keyDimensions: [
      { title: "Oral Communication", description: "Listening, speaking, and conversational interaction in formal and informal contexts." },
      { title: "Written Communication", description: "Reading comprehension, writing for different purposes and audiences, and text analysis." },
      { title: "Multimodal Communication", description: "Understanding and producing texts that combine language with images, sound, and digital formats." },
      { title: "Critical Language Use", description: "Identifying bias, evaluating sources, and using language ethically and responsibly." },
    ],
    descriptors: [
      {
        level: "Junior (Years 1–3)",
        items: [
          "Listens attentively and responds appropriately in simple conversations.",
          "Reads short texts with understanding and identifies the main idea.",
          "Writes simple sentences and short paragraphs with basic punctuation.",
          "Recognises that language can be used to express feelings and opinions.",
        ],
      },
      {
        level: "Primary (Years 4–6)",
        items: [
          "Participates in group discussions, taking turns and building on others' contributions.",
          "Reads a variety of texts (narrative, informational, poetic) and identifies purpose and audience.",
          "Plans and writes structured texts with an introduction, development, and conclusion.",
          "Identifies persuasive techniques and evaluates the reliability of information sources.",
          "Uses vocabulary from across the curriculum accurately and precisely.",
        ],
      },
      {
        level: "Secondary (Years 7–10 / ESO)",
        items: [
          "Produces and interprets complex oral and written texts in academic and social contexts.",
          "Analyses literary and non-literary texts using appropriate metalanguage.",
          "Constructs well-reasoned arguments in writing and debate, acknowledging counter-arguments.",
          "Evaluates the ideological and cultural dimensions of language use.",
          "Adapts register, tone, and style to diverse communicative situations.",
          "Uses digital tools to create, share, and critically evaluate multimodal texts.",
        ],
      },
    ],
    classroomExamples: [
      "Debating current events using structured argument frames.",
      "Writing a persuasive letter to a local authority on an environmental issue.",
      "Analysing the language of advertising and identifying rhetorical devices.",
      "Creating a class podcast or radio programme on a topic of student choice.",
      "Peer-editing written work using a shared rubric aligned to CCL descriptors.",
    ],
    linkedSubjects: ["Spanish Language & Literature", "Co-official Languages", "Foreign Languages", "Social Sciences", "All subjects"],
  },

  CP: {
    code: "CP",
    name: "Multilingual Competence",
    emoji: "🌐",
    fullName: "Competencia Plurilingüe (CP)",
    lomloeArticle: "Annex I, LOMLOE — Real Decreto 157/2022 & 217/2022",
    overview:
      "Multilingual Competence refers to the ability to use different languages appropriately and effectively for communication, and to participate in multilingual interactions. It involves an awareness of linguistic diversity, the ability to transfer linguistic knowledge across languages, and a positive attitude towards language learning and cultural diversity.",
    whyItMatters:
      "Spain is a linguistically diverse country with multiple co-official languages, and its students operate in an increasingly globalised world. Multilingual competence enables students to access wider knowledge, build intercultural bridges, and participate fully in European and global society.",
    keyDimensions: [
      { title: "Language Awareness", description: "Understanding how languages work and the relationships between them." },
      { title: "Communicative Strategies", description: "Using compensatory strategies when full proficiency is lacking (e.g. paraphrasing, code-switching)." },
      { title: "Intercultural Competence", description: "Recognising and respecting cultural differences embedded in language use." },
      { title: "Language Transfer", description: "Applying knowledge from one language to support learning of another." },
    ],
    descriptors: [
      {
        level: "Junior (Years 1–3)",
        items: [
          "Recognises that people speak different languages and that this is normal and valuable.",
          "Understands and uses simple phrases in a second language in familiar contexts.",
          "Shows curiosity about words from other languages and cultures.",
        ],
      },
      {
        level: "Primary (Years 4–6)",
        items: [
          "Communicates in a second language on familiar topics using learned phrases and simple sentences.",
          "Identifies similarities and differences between their first language and other languages.",
          "Demonstrates respect for speakers of other languages and linguistic varieties.",
          "Uses context and visual clues to infer meaning in a second language.",
        ],
      },
      {
        level: "Secondary (Years 7–10 / ESO)",
        items: [
          "Communicates effectively in two or more languages across a range of topics and contexts.",
          "Reflects on their own language learning process and applies effective strategies.",
          "Analyses how cultural values and worldviews are encoded in language.",
          "Mediates between languages and cultures in real or simulated situations.",
          "Uses digital tools to access, produce, and share content in multiple languages.",
        ],
      },
    ],
    classroomExamples: [
      "Content and Language Integrated Learning (CLIL) lessons in a second language.",
      "Comparing idiomatic expressions across Spanish, Catalan, and English.",
      "Pen-pal exchanges with students in other European countries.",
      "Translating a short text and reflecting on the challenges of translation.",
      "Researching a topic using sources in two different languages.",
    ],
    linkedSubjects: ["Foreign Languages (English, French, German)", "Co-official Languages (Catalan, Basque, Galician)", "Spanish Language & Literature", "Social Sciences"],
  },

  STEM: {
    code: "STEM",
    name: "Mathematics & STEM",
    emoji: "🔢",
    fullName: "Competencia Matemática y en Ciencia, Tecnología e Ingeniería (STEM)",
    lomloeArticle: "Annex I, LOMLOE — Real Decreto 157/2022 & 217/2022",
    overview:
      "STEM Competence encompasses the ability to formulate, apply, and interpret mathematics in a variety of contexts, and to engage with scientific inquiry, technological problem-solving, and engineering design thinking. It involves developing a scientific mindset — asking questions, forming hypotheses, gathering evidence, and drawing conclusions — as well as applying mathematical reasoning to real-world situations.",
    whyItMatters:
      "Mathematical and scientific literacy are foundational for informed citizenship, critical thinking, and participation in a technology-driven economy. STEM competence enables students to understand the world around them, make evidence-based decisions, and contribute to innovation and sustainable development.",
    keyDimensions: [
      { title: "Mathematical Reasoning", description: "Using logical thinking, abstraction, and proof to solve problems and communicate mathematical ideas." },
      { title: "Scientific Inquiry", description: "Designing and conducting investigations, analysing data, and drawing evidence-based conclusions." },
      { title: "Technological Literacy", description: "Understanding how technology works and using it responsibly to solve problems." },
      { title: "Engineering Design", description: "Applying a design-build-test-improve cycle to create solutions to real challenges." },
    ],
    descriptors: [
      {
        level: "Junior (Years 1–3)",
        items: [
          "Counts, orders, and compares numbers; performs basic arithmetic operations.",
          "Identifies shapes, patterns, and simple measurements in everyday contexts.",
          "Asks questions about the natural world and makes simple observations.",
          "Uses basic tools and materials to build simple structures.",
        ],
      },
      {
        level: "Primary (Years 4–6)",
        items: [
          "Solves multi-step arithmetic problems and explains the reasoning used.",
          "Collects, organises, and represents data using tables and graphs.",
          "Designs and carries out simple scientific experiments with teacher guidance.",
          "Identifies cause-and-effect relationships in natural phenomena.",
          "Uses technology purposefully to support learning and problem-solving.",
        ],
      },
      {
        level: "Secondary (Years 7–10 / ESO)",
        items: [
          "Applies algebraic, geometric, and statistical reasoning to solve complex problems.",
          "Designs and conducts independent scientific investigations, evaluating methodology.",
          "Interprets and critically evaluates scientific data, including media representations.",
          "Applies engineering design principles to create and test solutions to real problems.",
          "Understands the social, ethical, and environmental implications of scientific and technological advances.",
          "Uses digital tools (spreadsheets, simulations, coding) to model and analyse phenomena.",
        ],
      },
    ],
    classroomExamples: [
      "Designing a bridge from recycled materials and testing its load capacity.",
      "Analysing real statistical data (e.g. climate data) to identify trends.",
      "Coding a simple simulation of a physical system.",
      "Investigating the mathematics of music (frequency, ratios, patterns).",
      "Evaluating news articles about scientific claims using evidence-based criteria.",
    ],
    linkedSubjects: ["Mathematics", "Natural Sciences", "Physics & Chemistry", "Biology & Geology", "Technology & Engineering", "Computer Science"],
  },

  CD: {
    code: "CD",
    name: "Digital Competence",
    emoji: "💻",
    fullName: "Competencia Digital (CD)",
    lomloeArticle: "Annex I, LOMLOE — Real Decreto 157/2022 & 217/2022",
    overview:
      "Digital Competence involves the confident, critical, and responsible use of digital technologies for learning, work, and participation in society. It encompasses five areas: information and data literacy, communication and collaboration, digital content creation, safety and well-being, and problem-solving. It also includes understanding the social, ethical, and legal dimensions of digital life.",
    whyItMatters:
      "Digital technologies permeate every aspect of modern life. Digital competence enables students to navigate the information landscape critically, protect their privacy and well-being online, create meaningful digital content, and participate as active, responsible digital citizens.",
    keyDimensions: [
      { title: "Information & Data Literacy", description: "Searching, evaluating, and managing digital information and data." },
      { title: "Communication & Collaboration", description: "Interacting, collaborating, and sharing through digital technologies." },
      { title: "Digital Content Creation", description: "Creating and editing digital content, understanding copyright and licences." },
      { title: "Safety & Well-being", description: "Protecting devices, data, privacy, and mental health in digital environments." },
      { title: "Problem-solving", description: "Using digital tools to solve problems and identify gaps in digital competence." },
    ],
    descriptors: [
      {
        level: "Junior (Years 1–3)",
        items: [
          "Uses basic digital devices (tablet, computer) safely with adult supervision.",
          "Searches for information online with guidance and identifies relevant results.",
          "Creates simple digital content (drawings, short texts) using age-appropriate tools.",
          "Understands basic rules for safe and respectful online behaviour.",
        ],
      },
      {
        level: "Primary (Years 4–6)",
        items: [
          "Searches for, evaluates, and organises digital information independently.",
          "Uses digital tools to collaborate with peers on shared projects.",
          "Creates multimodal digital content (presentations, videos, blogs) for a defined audience.",
          "Identifies risks in digital environments (cyberbullying, misinformation) and applies protective strategies.",
          "Understands basic concepts of copyright and responsible sharing.",
        ],
      },
      {
        level: "Secondary (Years 7–10 / ESO)",
        items: [
          "Critically evaluates digital sources for reliability, bias, and purpose.",
          "Uses digital platforms to collaborate, communicate, and share knowledge responsibly.",
          "Creates sophisticated digital content applying principles of design, accessibility, and copyright.",
          "Manages digital identity, privacy settings, and personal data consciously.",
          "Applies computational thinking and basic programming to solve problems.",
          "Reflects on the ethical, social, and environmental impact of digital technologies.",
        ],
      },
    ],
    classroomExamples: [
      "Fact-checking a viral social media post using multiple sources.",
      "Collaborating on a shared document or presentation using cloud tools.",
      "Creating a short documentary or explainer video on a curriculum topic.",
      "Designing a simple website or app prototype.",
      "Discussing the ethics of AI, data collection, and algorithmic bias.",
    ],
    linkedSubjects: ["Computer Science / Informatics", "Technology", "All subjects (cross-curricular)", "Social Sciences", "Ethics"],
  },

  CPSAA: {
    code: "CPSAA",
    name: "Personal, Social & Learning to Learn",
    emoji: "🤝",
    fullName: "Competencia Personal, Social y de Aprender a Aprender (CPSAA)",
    lomloeArticle: "Annex I, LOMLOE — Real Decreto 157/2022 & 217/2022",
    overview:
      "This competence integrates three interconnected dimensions: personal development (self-awareness, emotional regulation, resilience), social skills (empathy, collaboration, conflict resolution), and metacognitive learning strategies (planning, monitoring, and evaluating one's own learning). It is foundational for lifelong learning and active participation in society.",
    whyItMatters:
      "The ability to understand oneself, relate constructively to others, and take ownership of one's learning is essential for academic success, mental well-being, and responsible citizenship. CPSAA equips students with the inner resources to navigate complexity, setbacks, and change throughout life.",
    keyDimensions: [
      { title: "Self-awareness & Emotional Regulation", description: "Recognising and managing one's emotions, strengths, and limitations." },
      { title: "Resilience & Growth Mindset", description: "Persisting through challenges and viewing mistakes as learning opportunities." },
      { title: "Social Skills & Empathy", description: "Collaborating effectively, resolving conflicts constructively, and showing empathy." },
      { title: "Learning Strategies", description: "Planning, monitoring, and evaluating one's own learning processes." },
    ],
    descriptors: [
      {
        level: "Junior (Years 1–3)",
        items: [
          "Identifies and names basic emotions in themselves and others.",
          "Asks for help when needed and accepts support from peers and adults.",
          "Participates in group activities, taking turns and sharing materials.",
          "Begins to identify what they find easy or difficult in their learning.",
        ],
      },
      {
        level: "Primary (Years 4–6)",
        items: [
          "Manages frustration and persists with challenging tasks.",
          "Works collaboratively in groups, contributing fairly and listening to others.",
          "Reflects on their learning using simple self-assessment tools.",
          "Sets short-term learning goals and monitors progress towards them.",
          "Resolves minor conflicts with peers using negotiation and compromise.",
        ],
      },
      {
        level: "Secondary (Years 7–10 / ESO)",
        items: [
          "Demonstrates self-regulation strategies in demanding academic and social situations.",
          "Leads and participates in collaborative projects, managing roles and responsibilities.",
          "Applies a range of learning strategies (mind-mapping, spaced practice, elaborative interrogation) independently.",
          "Evaluates their own learning critically and adjusts strategies accordingly.",
          "Shows empathy and takes others' perspectives in complex social situations.",
          "Develops a personal learning plan aligned to their interests and aspirations.",
        ],
      },
    ],
    classroomExamples: [
      "Keeping a learning journal to reflect on progress and set weekly goals.",
      "Structured cooperative learning activities with assigned roles.",
      "Restorative circles for conflict resolution.",
      "Mindfulness or emotional check-in routines at the start of lessons.",
      "Peer feedback sessions using a structured protocol.",
    ],
    linkedSubjects: ["Tutorial / Personal Development", "All subjects (cross-curricular)", "Physical Education", "Ethics", "Philosophy"],
  },

  CC: {
    code: "CC",
    name: "Civic Competence",
    emoji: "🏛️",
    fullName: "Competencia Ciudadana (CC)",
    lomloeArticle: "Annex I, LOMLOE — Real Decreto 157/2022 & 217/2022",
    overview:
      "Civic Competence refers to the ability to act as informed, responsible, and active citizens. It encompasses knowledge of democratic institutions and processes, respect for human rights and the rule of law, critical understanding of social and political issues, and the disposition to participate constructively in civic life at local, national, European, and global levels.",
    whyItMatters:
      "Democracy requires informed and engaged citizens. Civic competence equips students to understand how society is organised, to defend their rights and respect those of others, to engage with political and social issues critically, and to contribute to a just, peaceful, and sustainable world.",
    keyDimensions: [
      { title: "Democratic Knowledge", description: "Understanding democratic institutions, human rights, and the rule of law." },
      { title: "Critical Social Understanding", description: "Analysing social, political, and economic issues from multiple perspectives." },
      { title: "Civic Participation", description: "Engaging actively and responsibly in school, local, and wider civic life." },
      { title: "Intercultural Dialogue", description: "Respecting diversity and building bridges across cultural and social differences." },
    ],
    descriptors: [
      {
        level: "Junior (Years 1–3)",
        items: [
          "Understands and follows class and school rules, recognising their purpose.",
          "Identifies basic rights and responsibilities in the school community.",
          "Shows respect for classmates from different backgrounds and cultures.",
          "Participates in simple democratic processes (class votes, class council).",
        ],
      },
      {
        level: "Primary (Years 4–6)",
        items: [
          "Explains the structure of local and national government and their functions.",
          "Identifies examples of human rights and situations where they are violated.",
          "Participates in school democratic structures (student council, class assemblies).",
          "Analyses social issues (inequality, discrimination) and proposes constructive responses.",
          "Demonstrates solidarity and respect in interactions with diverse peers.",
        ],
      },
      {
        level: "Secondary (Years 7–10 / ESO)",
        items: [
          "Analyses the functioning of democratic systems and their strengths and weaknesses.",
          "Evaluates current social, political, and environmental issues using multiple sources.",
          "Participates in civic action (campaigns, petitions, community projects) at school or local level.",
          "Defends positions on ethical and social issues with reasoned arguments, respecting dissent.",
          "Understands the role of international organisations (UN, EU, Council of Europe) in global governance.",
          "Reflects on their own identity, values, and responsibilities as a citizen.",
        ],
      },
    ],
    classroomExamples: [
      "Simulating a parliamentary debate on a current social issue.",
      "Researching and presenting on a human rights case study.",
      "Organising a school fundraising or awareness campaign for a social cause.",
      "Analysing election manifestos and comparing political positions.",
      "Creating a class constitution or charter of rights and responsibilities.",
    ],
    linkedSubjects: ["Social Sciences", "History", "Geography", "Ethics", "Philosophy", "Tutorial"],
  },

  CE: {
    code: "CE",
    name: "Entrepreneurial Competence",
    emoji: "💡",
    fullName: "Competencia Emprendedora (CE)",
    lomloeArticle: "Annex I, LOMLOE — Real Decreto 157/2022 & 217/2022",
    overview:
      "Entrepreneurial Competence refers to the capacity to act on opportunities and ideas, transforming them into value for others. It encompasses creativity, initiative, planning, risk management, and the ability to work collaboratively to achieve goals. It applies not only to business ventures but to any context where proactive, creative problem-solving is required — social projects, community initiatives, and personal development.",
    whyItMatters:
      "The ability to identify opportunities, take initiative, and see projects through to completion is valuable in every area of life. Entrepreneurial competence fosters creativity, resilience, and a sense of agency — empowering students to shape their own futures and contribute positively to their communities.",
    keyDimensions: [
      { title: "Creativity & Innovation", description: "Generating original ideas and approaches to problems and opportunities." },
      { title: "Vision & Planning", description: "Setting goals, planning steps, and anticipating challenges." },
      { title: "Taking Initiative & Risk", description: "Acting proactively, making decisions under uncertainty, and learning from failure." },
      { title: "Collaboration & Leadership", description: "Working with others to achieve shared goals, motivating and organising a team." },
    ],
    descriptors: [
      {
        level: "Junior (Years 1–3)",
        items: [
          "Generates creative ideas and tries new approaches to tasks.",
          "Completes self-initiated projects with support from adults.",
          "Shows willingness to try again after making a mistake.",
          "Contributes ideas to group activities and listens to others' suggestions.",
        ],
      },
      {
        level: "Primary (Years 4–6)",
        items: [
          "Identifies a problem or need in their school or community and proposes a solution.",
          "Plans a simple project with steps, resources, and a timeline.",
          "Works in a team to carry out a project, taking on different roles.",
          "Evaluates the outcomes of a project and identifies what could be improved.",
          "Shows resilience when plans do not work out as expected.",
        ],
      },
      {
        level: "Secondary (Years 7–10 / ESO)",
        items: [
          "Develops and pitches an original project or venture addressing a real need.",
          "Applies design thinking or lean startup methodologies to project development.",
          "Manages resources, timelines, and team dynamics in a complex project.",
          "Evaluates risk and makes informed decisions under uncertainty.",
          "Reflects critically on the social and ethical dimensions of entrepreneurial activity.",
          "Demonstrates leadership, adaptability, and a growth mindset throughout a project lifecycle.",
        ],
      },
    ],
    classroomExamples: [
      "Running a school mini-enterprise (product design, production, marketing, sales).",
      "Design thinking challenge: redesigning a school space or service.",
      "Pitching a social enterprise idea to a panel of 'investors'.",
      "Hackathon: solving a community problem using technology in 24 hours.",
      "Interviewing local entrepreneurs and reflecting on their journeys.",
    ],
    linkedSubjects: ["Technology", "Business Studies", "Art & Design", "Computer Science", "Tutorial", "All subjects (cross-curricular)"],
  },

  CCEC: {
    code: "CCEC",
    name: "Cultural Awareness & Expression",
    emoji: "🎨",
    fullName: "Competencia en Conciencia y Expresión Culturales (CCEC)",
    lomloeArticle: "Annex I, LOMLOE — Real Decreto 157/2022 & 217/2022",
    overview:
      "Cultural Awareness and Expression Competence refers to the ability to understand and respect the creative expression of ideas, experiences, and emotions through art, music, literature, film, and other cultural forms. It involves both the appreciation of cultural heritage and contemporary expression, and the ability to create and communicate through artistic and cultural means.",
    whyItMatters:
      "Culture and the arts are central to human identity, social cohesion, and the transmission of values across generations. CCEC enables students to engage with cultural diversity with curiosity and respect, to express themselves creatively, and to contribute to the cultural life of their communities.",
    keyDimensions: [
      { title: "Cultural Knowledge & Appreciation", description: "Understanding and appreciating artistic and cultural heritage, past and present." },
      { title: "Creative Expression", description: "Expressing ideas, emotions, and experiences through a variety of artistic media." },
      { title: "Critical Cultural Analysis", description: "Interpreting and evaluating cultural and artistic works in their social and historical context." },
      { title: "Intercultural Dialogue", description: "Engaging with cultural diversity and recognising the value of different cultural traditions." },
    ],
    descriptors: [
      {
        level: "Junior (Years 1–3)",
        items: [
          "Explores and enjoys a variety of artistic forms (music, visual art, drama, dance).",
          "Creates simple artistic works expressing personal ideas or feelings.",
          "Recognises cultural celebrations and traditions from their own and other communities.",
          "Responds to works of art with curiosity and simple personal reflection.",
        ],
      },
      {
        level: "Primary (Years 4–6)",
        items: [
          "Analyses works of art, music, and literature, identifying key features and techniques.",
          "Creates artistic works in a range of media with increasing skill and intentionality.",
          "Compares cultural traditions and artistic forms from different countries and periods.",
          "Participates in cultural events and performances at school and in the community.",
          "Reflects on how art and culture shape and reflect social values and identities.",
        ],
      },
      {
        level: "Secondary (Years 7–10 / ESO)",
        items: [
          "Analyses and interprets complex artistic and cultural works in their historical and social context.",
          "Creates sophisticated artistic works demonstrating technical skill and personal voice.",
          "Evaluates the role of culture and the arts in social change and identity formation.",
          "Engages with cultural diversity critically and empathetically, challenging stereotypes.",
          "Uses cultural and artistic references to enrich their own creative and academic work.",
          "Reflects on their own cultural identity and its relationship to wider cultural traditions.",
        ],
      },
    ],
    classroomExamples: [
      "Analysing a painting, film, or musical work in its historical context.",
      "Creating a multimedia art project inspired by a cultural theme.",
      "Attending a theatre performance or museum visit and writing a critical review.",
      "Exploring the music, dance, and visual arts of a non-European culture.",
      "Organising a school cultural festival celebrating the diversity of the school community.",
    ],
    linkedSubjects: ["Art & Design", "Music", "Drama / Performing Arts", "Spanish Language & Literature", "History", "Social Sciences"],
  },
};

/* ─────────────────────────────────────────────────────────────────────────────
   Component
───────────────────────────────────────────────────────────────────────────── */
export default function CompetencyDetail({ params }: { params: { code: string } }) {
  const { t } = useI18n();
  const [, navigate] = useLocation();
  const code = (params?.code ?? "").toUpperCase();
  const comp = COMPETENCY_DETAIL[code];

  if (!comp) {
    return (
      <div className="min-h-screen flex flex-col">
        <NavBar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-2xl font-bold text-foreground mb-2">Competency not found</p>
            <Button asChild variant="outline">
              <Link href="/">{t("cd_back_to_competencies")}</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const accentColor = COMP_COLORS[code] ?? "oklch(0.50 0.18 240)";

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <NavBar />

      {/* Hero banner */}
      <section
        className="relative overflow-hidden border-b border-border"
        style={{ background: `linear-gradient(135deg, ${accentColor} 0%, oklch(0.15 0.05 240) 100%)` }}
      >
        <div className="absolute inset-0 opacity-10 pointer-events-none"
          style={{ backgroundImage: "radial-gradient(circle at 70% 50%, white 0%, transparent 60%)" }} />
        <div className="container py-10 sm:py-14 relative z-10">
          {/* Back button */}
          <Button
            variant="ghost"
            size="sm"
            className="text-white/80 hover:text-white hover:bg-white/10 mb-6 -ml-2"
            onClick={() => navigate("/")}
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            {t("cd_back_to_competencies")}
          </Button>

          <div className="flex items-start gap-5">
            <div className="text-5xl sm:text-6xl select-none">{comp.emoji}</div>
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <Badge
                  className="text-sm font-bold px-3 py-1 border-0"
                  style={{ background: "rgba(255,255,255,0.2)", color: "white" }}
                >
                  {comp.code}
                </Badge>
                <span className="text-white/60 text-sm">{comp.lomloeArticle}</span>
              </div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-2 drop-shadow">
                {comp.name}
              </h1>
              <p className="text-white/70 text-sm italic">{comp.fullName}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Main content */}
      <div className="container py-10 flex flex-col gap-8 max-w-5xl">

        {/* Overview */}
        <section>
          <h2 className="text-xl font-bold text-foreground mb-3 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary" />
            {t("cd_overview")}
          </h2>
          <p className="text-muted-foreground leading-relaxed">{comp.overview}</p>
        </section>

        {/* Why it matters */}
        <section className="rounded-xl p-5 border border-border bg-secondary/30">
          <h2 className="text-lg font-bold text-foreground mb-2">{t("cd_why_matters")}</h2>
          <p className="text-muted-foreground leading-relaxed">{comp.whyItMatters}</p>
        </section>

        {/* Key dimensions */}
        <section>
          <h2 className="text-xl font-bold text-foreground mb-4">{t("cd_key_dimensions")}</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {comp.keyDimensions.map((dim, i) => (
              <Card key={i} className="border-border">
                <CardContent className="p-5">
                  <div className="flex items-start gap-3">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold shrink-0 mt-0.5"
                      style={{ background: accentColor }}
                    >
                      {i + 1}
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground mb-1">{dim.title}</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">{dim.description}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Descriptors by level */}
        <section>
          <h2 className="text-xl font-bold text-foreground mb-4">{t("cd_descriptors")}</h2>
          <div className="flex flex-col gap-4">
            {comp.descriptors.map((level, li) => (
              <Card key={li} className="border-border overflow-hidden">
                <CardHeader
                  className="py-3 px-5 border-b border-border"
                  style={{ background: `${accentColor}22` }}
                >
                  <CardTitle className="text-base font-bold text-foreground">{level.level}</CardTitle>
                </CardHeader>
                <CardContent className="p-5">
                  <ul className="flex flex-col gap-2">
                    {level.items.map((item, ii) => (
                      <li key={ii} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <ChevronRight
                          className="w-4 h-4 mt-0.5 shrink-0"
                          style={{ color: accentColor }}
                        />
                        {item}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Classroom examples */}
        <section>
          <h2 className="text-xl font-bold text-foreground mb-4">{t("cd_classroom_examples")}</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {comp.classroomExamples.map((ex, i) => (
              <div
                key={i}
                className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground leading-relaxed"
              >
                <span
                  className="font-bold text-xs mr-2 px-1.5 py-0.5 rounded"
                  style={{ background: `${accentColor}33`, color: accentColor }}
                >
                  {i + 1}
                </span>
                {ex}
              </div>
            ))}
          </div>
        </section>

        {/* Linked subjects */}
        <section>
          <h2 className="text-xl font-bold text-foreground mb-3">{t("cd_linked_subjects")}</h2>
          <div className="flex flex-wrap gap-2">
            {comp.linkedSubjects.map((subj, i) => (
              <Badge key={i} variant="secondary" className="text-sm px-3 py-1">
                {subj}
              </Badge>
            ))}
          </div>
        </section>

        {/* Quick actions */}
        <section className="border-t border-border pt-8 flex flex-col sm:flex-row gap-3">
          <Button asChild size="lg" className="gap-2">
            <Link href={`/practice?competency=${comp.code}`}>
              {t("cd_practice_this")} <ChevronRight className="w-4 h-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="gap-2">
            <Link href={`/create?competency=${comp.code}`}>
              {t("cd_create_materials")} <ChevronRight className="w-4 h-4" />
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="lg"
            className="gap-2"
            onClick={() => navigate("/")}
          >
            <ArrowLeft className="w-4 h-4" />
            {t("cd_back_to_competencies")}
          </Button>
        </section>

        {/* Powered by SEBA */}
        <p className="text-xs text-muted-foreground text-center pb-4">Powered by SEBA</p>
      </div>
    </div>
  );
}
