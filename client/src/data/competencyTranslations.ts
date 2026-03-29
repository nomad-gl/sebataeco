/* ─────────────────────────────────────────────────────────────────────────────
   Competency content translations — ES and CA
   Source: Real Decreto 157/2022 (Primaria) & Real Decreto 217/2022 (ESO)
   EN content lives in CompetencyDetail.tsx (COMPETENCY_DETAIL).
   This file exports ES and CA overrides keyed by competency code.
───────────────────────────────────────────────────────────────────────────── */

export interface CompetencyContent {
  name: string;
  overview: string;
  whyItMatters: string;
  keyDimensions: { title: string; description: string }[];
  descriptors: { level: string; items: string[] }[];
  classroomExamples: string[];
  linkedSubjects: string[];
}

export type CompetencyTranslations = Record<string, CompetencyContent>;

/* ─── Spanish (ES) ─────────────────────────────────────────────────────────── */
export const COMPETENCY_DETAIL_ES: CompetencyTranslations = {
  CCL: {
    name: "Comunicación Lingüística",
    overview:
      "La competencia en Comunicación Lingüística hace referencia a la capacidad de utilizar la lengua —oral y escrita— como instrumento de comunicación, representación, interpretación y comprensión de la realidad. Engloba la habilidad de expresar y comprender ideas, sentimientos, hechos y opiniones de forma oral y escrita, e interactuar lingüísticamente de manera adecuada, creativa y crítica en una amplia variedad de contextos socioculturales y comunicativos.",
    whyItMatters:
      "La lengua es el medio principal a través del cual se produce todo aprendizaje. Una sólida competencia lingüística permite al alumnado acceder al conocimiento en todas las materias, participar en la vida democrática y desarrollar su identidad personal y profesional.",
    keyDimensions: [
      { title: "Comunicación oral", description: "Escucha, expresión oral e interacción conversacional en contextos formales e informales." },
      { title: "Comunicación escrita", description: "Comprensión lectora, escritura para diferentes propósitos y audiencias, y análisis de textos." },
      { title: "Comunicación multimodal", description: "Comprensión y producción de textos que combinan lenguaje con imágenes, sonido y formatos digitales." },
      { title: "Uso crítico del lenguaje", description: "Identificar sesgos, evaluar fuentes y usar el lenguaje de forma ética y responsable." },
    ],
    descriptors: [
      {
        level: "Inicial (1.º–3.º de Primaria)",
        items: [
          "Escucha con atención y responde adecuadamente en conversaciones sencillas.",
          "Lee textos breves con comprensión e identifica la idea principal.",
          "Escribe oraciones simples y párrafos cortos con puntuación básica.",
          "Reconoce que el lenguaje puede usarse para expresar sentimientos y opiniones.",
        ],
      },
      {
        level: "Primaria (4.º–6.º de Primaria)",
        items: [
          "Participa en debates en grupo, respetando los turnos y construyendo sobre las aportaciones de los demás.",
          "Lee distintos tipos de textos (narrativo, informativo, poético) e identifica el propósito y la audiencia.",
          "Planifica y escribe textos estructurados con introducción, desarrollo y conclusión.",
          "Identifica técnicas persuasivas y evalúa la fiabilidad de las fuentes de información.",
          "Usa vocabulario de las distintas materias con precisión y exactitud.",
        ],
      },
      {
        level: "Secundaria (1.º–4.º de ESO)",
        items: [
          "Produce e interpreta textos orales y escritos complejos en contextos académicos y sociales.",
          "Analiza textos literarios y no literarios usando metalenguaje apropiado.",
          "Construye argumentos bien razonados por escrito y en debate, reconociendo contraargumentos.",
          "Evalúa las dimensiones ideológicas y culturales del uso del lenguaje.",
          "Adapta el registro, el tono y el estilo a diversas situaciones comunicativas.",
          "Usa herramientas digitales para crear, compartir y evaluar críticamente textos multimodales.",
        ],
      },
    ],
    classroomExamples: [
      "Debatir temas de actualidad usando marcos de argumentación estructurada.",
      "Escribir una carta persuasiva a una autoridad local sobre un problema medioambiental.",
      "Analizar el lenguaje publicitario e identificar recursos retóricos.",
      "Crear un pódcast o programa de radio de clase sobre un tema elegido por el alumnado.",
      "Revisar textos escritos entre iguales usando una rúbrica alineada con los descriptores de la CCL.",
    ],
    linkedSubjects: ["Lengua Castellana y Literatura", "Lenguas Cooficiales", "Lenguas Extranjeras", "Ciencias Sociales", "Todas las materias"],
  },

  CP: {
    name: "Competencia Plurilingüe",
    overview:
      "La Competencia Plurilingüe hace referencia a la capacidad de utilizar distintas lenguas de forma adecuada y eficaz para la comunicación, y de participar en interacciones multilingües. Implica una conciencia de la diversidad lingüística, la capacidad de transferir conocimientos lingüísticos entre lenguas y una actitud positiva hacia el aprendizaje de idiomas y la diversidad cultural.",
    whyItMatters:
      "España es un país lingüísticamente diverso con varias lenguas cooficiales, y su alumnado se desenvuelve en un mundo cada vez más globalizado. La competencia plurilingüe permite acceder a un conocimiento más amplio, construir puentes interculturales y participar plenamente en la sociedad europea y global.",
    keyDimensions: [
      { title: "Conciencia lingüística", description: "Comprender cómo funcionan las lenguas y las relaciones entre ellas." },
      { title: "Estrategias comunicativas", description: "Usar estrategias compensatorias cuando no se tiene plena competencia (p. ej., paráfrasis, alternancia de códigos)." },
      { title: "Competencia intercultural", description: "Reconocer y respetar las diferencias culturales presentes en el uso de la lengua." },
      { title: "Transferencia lingüística", description: "Aplicar el conocimiento de una lengua para apoyar el aprendizaje de otra." },
    ],
    descriptors: [
      {
        level: "Inicial (1.º–3.º de Primaria)",
        items: [
          "Reconoce que las personas hablan distintas lenguas y que esto es normal y valioso.",
          "Comprende y usa frases sencillas en una segunda lengua en contextos familiares.",
          "Muestra curiosidad por palabras de otras lenguas y culturas.",
        ],
      },
      {
        level: "Primaria (4.º–6.º de Primaria)",
        items: [
          "Se comunica en una segunda lengua sobre temas familiares usando frases aprendidas y oraciones simples.",
          "Identifica similitudes y diferencias entre su lengua materna y otras lenguas.",
          "Muestra respeto por los hablantes de otras lenguas y variedades lingüísticas.",
          "Usa el contexto y pistas visuales para inferir el significado en una segunda lengua.",
        ],
      },
      {
        level: "Secundaria (1.º–4.º de ESO)",
        items: [
          "Se comunica eficazmente en dos o más lenguas sobre una variedad de temas y contextos.",
          "Reflexiona sobre su propio proceso de aprendizaje de lenguas y aplica estrategias eficaces.",
          "Analiza cómo los valores culturales y las visiones del mundo se codifican en el lenguaje.",
          "Media entre lenguas y culturas en situaciones reales o simuladas.",
          "Usa herramientas digitales para acceder, producir y compartir contenido en varios idiomas.",
        ],
      },
    ],
    classroomExamples: [
      "Clases de Aprendizaje Integrado de Contenidos y Lenguas Extranjeras (AICLE) en una segunda lengua.",
      "Comparar expresiones idiomáticas en castellano, catalán e inglés.",
      "Intercambios epistolares con estudiantes de otros países europeos.",
      "Traducir un texto breve y reflexionar sobre los retos de la traducción.",
      "Investigar un tema usando fuentes en dos lenguas distintas.",
    ],
    linkedSubjects: ["Lenguas Extranjeras (inglés, francés, alemán)", "Lenguas Cooficiales (catalán, euskera, gallego)", "Lengua Castellana y Literatura", "Ciencias Sociales"],
  },

  STEM: {
    name: "Competencia Matemática y en Ciencia, Tecnología e Ingeniería",
    overview:
      "La Competencia STEM engloba la capacidad de formular, aplicar e interpretar las matemáticas en una variedad de contextos, y de participar en la indagación científica, la resolución tecnológica de problemas y el pensamiento de diseño en ingeniería. Implica desarrollar una mentalidad científica —formular preguntas, plantear hipótesis, recopilar evidencias y extraer conclusiones— así como aplicar el razonamiento matemático a situaciones del mundo real.",
    whyItMatters:
      "La alfabetización matemática y científica es fundamental para una ciudadanía informada, el pensamiento crítico y la participación en una economía impulsada por la tecnología. La competencia STEM permite al alumnado comprender el mundo que le rodea, tomar decisiones basadas en evidencias y contribuir a la innovación y el desarrollo sostenible.",
    keyDimensions: [
      { title: "Razonamiento matemático", description: "Usar el pensamiento lógico, la abstracción y la demostración para resolver problemas y comunicar ideas matemáticas." },
      { title: "Indagación científica", description: "Diseñar y realizar investigaciones, analizar datos y extraer conclusiones basadas en evidencias." },
      { title: "Alfabetización tecnológica", description: "Comprender cómo funciona la tecnología y usarla de forma responsable para resolver problemas." },
      { title: "Diseño en ingeniería", description: "Aplicar un ciclo de diseño-construcción-prueba-mejora para crear soluciones a retos reales." },
    ],
    descriptors: [
      {
        level: "Inicial (1.º–3.º de Primaria)",
        items: [
          "Cuenta, ordena y compara números; realiza operaciones aritméticas básicas.",
          "Identifica formas, patrones y medidas sencillas en contextos cotidianos.",
          "Formula preguntas sobre el mundo natural y realiza observaciones simples.",
          "Usa herramientas y materiales básicos para construir estructuras sencillas.",
        ],
      },
      {
        level: "Primaria (4.º–6.º de Primaria)",
        items: [
          "Resuelve problemas aritméticos de varios pasos y explica el razonamiento utilizado.",
          "Recoge, organiza y representa datos mediante tablas y gráficos.",
          "Diseña y realiza experimentos científicos sencillos con orientación del docente.",
          "Identifica relaciones de causa y efecto en fenómenos naturales.",
          "Usa la tecnología de forma intencionada para apoyar el aprendizaje y la resolución de problemas.",
        ],
      },
      {
        level: "Secundaria (1.º–4.º de ESO)",
        items: [
          "Aplica razonamiento algebraico, geométrico y estadístico para resolver problemas complejos.",
          "Diseña y realiza investigaciones científicas independientes, evaluando la metodología.",
          "Interpreta y evalúa críticamente datos científicos, incluidas las representaciones en los medios.",
          "Aplica principios de diseño en ingeniería para crear y probar soluciones a problemas reales.",
          "Comprende las implicaciones sociales, éticas y medioambientales de los avances científicos y tecnológicos.",
          "Usa herramientas digitales (hojas de cálculo, simulaciones, programación) para modelar y analizar fenómenos.",
        ],
      },
    ],
    classroomExamples: [
      "Diseñar un puente con materiales reciclados y probar su capacidad de carga.",
      "Analizar datos estadísticos reales (p. ej., datos climáticos) para identificar tendencias.",
      "Programar una simulación sencilla de un sistema físico.",
      "Investigar las matemáticas de la música (frecuencia, proporciones, patrones).",
      "Evaluar artículos de noticias sobre afirmaciones científicas usando criterios basados en evidencias.",
    ],
    linkedSubjects: ["Matemáticas", "Ciencias Naturales", "Física y Química", "Biología y Geología", "Tecnología e Ingeniería", "Informática"],
  },

  CD: {
    name: "Competencia Digital",
    overview:
      "La Competencia Digital implica el uso confiado, crítico y responsable de las tecnologías digitales para el aprendizaje, el trabajo y la participación en la sociedad. Abarca cinco áreas: alfabetización en información y datos, comunicación y colaboración, creación de contenidos digitales, seguridad y bienestar, y resolución de problemas. También incluye la comprensión de las dimensiones sociales, éticas y legales de la vida digital.",
    whyItMatters:
      "Las tecnologías digitales impregnan todos los aspectos de la vida moderna. La competencia digital permite al alumnado navegar críticamente por el panorama informativo, proteger su privacidad y bienestar en línea, crear contenidos digitales significativos y participar como ciudadanos digitales activos y responsables.",
    keyDimensions: [
      { title: "Alfabetización en información y datos", description: "Buscar, evaluar y gestionar información y datos digitales." },
      { title: "Comunicación y colaboración", description: "Interactuar, colaborar y compartir a través de tecnologías digitales." },
      { title: "Creación de contenidos digitales", description: "Crear y editar contenidos digitales, comprendiendo los derechos de autor y las licencias." },
      { title: "Seguridad y bienestar", description: "Proteger dispositivos, datos, privacidad y salud mental en entornos digitales." },
      { title: "Resolución de problemas", description: "Usar herramientas digitales para resolver problemas e identificar lagunas en la competencia digital." },
    ],
    descriptors: [
      {
        level: "Inicial (1.º–3.º de Primaria)",
        items: [
          "Usa dispositivos digitales básicos (tableta, ordenador) de forma segura con supervisión adulta.",
          "Busca información en línea con orientación e identifica resultados relevantes.",
          "Crea contenidos digitales sencillos (dibujos, textos cortos) con herramientas adecuadas a su edad.",
          "Comprende las normas básicas de comportamiento seguro y respetuoso en línea.",
        ],
      },
      {
        level: "Primaria (4.º–6.º de Primaria)",
        items: [
          "Busca, evalúa y organiza información digital de forma independiente.",
          "Usa herramientas digitales para colaborar con sus compañeros en proyectos compartidos.",
          "Crea contenidos digitales multimodales (presentaciones, vídeos, blogs) para una audiencia definida.",
          "Identifica riesgos en entornos digitales (ciberacoso, desinformación) y aplica estrategias de protección.",
          "Comprende conceptos básicos de derechos de autor y uso responsable.",
        ],
      },
      {
        level: "Secundaria (1.º–4.º de ESO)",
        items: [
          "Evalúa críticamente fuentes digitales en cuanto a fiabilidad, sesgo y propósito.",
          "Usa plataformas digitales para colaborar, comunicarse y compartir conocimiento de forma responsable.",
          "Crea contenidos digitales sofisticados aplicando principios de diseño, accesibilidad y derechos de autor.",
          "Gestiona la identidad digital, la configuración de privacidad y los datos personales de forma consciente.",
          "Aplica el pensamiento computacional y la programación básica para resolver problemas.",
          "Analiza las implicaciones éticas y sociales de la IA, la recopilación de datos y el sesgo algorítmico.",
        ],
      },
    ],
    classroomExamples: [
      "Verificar la veracidad de una publicación viral en redes sociales usando múltiples fuentes.",
      "Colaborar en un documento o presentación compartida usando herramientas en la nube.",
      "Crear un documental corto o vídeo explicativo sobre un tema curricular.",
      "Diseñar un prototipo sencillo de sitio web o aplicación.",
      "Debatir sobre la ética de la IA, la recopilación de datos y el sesgo algorítmico.",
    ],
    linkedSubjects: ["Informática", "Tecnología", "Todas las materias (transversal)", "Ciencias Sociales", "Ética"],
  },

  CPSAA: {
    name: "Competencia Personal, Social y de Aprender a Aprender",
    overview:
      "Esta competencia integra tres dimensiones interconectadas: el desarrollo personal (autoconciencia, regulación emocional, resiliencia), las habilidades sociales (empatía, colaboración, resolución de conflictos) y las estrategias metacognitivas de aprendizaje (planificación, supervisión y evaluación del propio aprendizaje). Es fundamental para el aprendizaje a lo largo de la vida y la participación activa en la sociedad.",
    whyItMatters:
      "La capacidad de conocerse a uno mismo, relacionarse constructivamente con los demás y asumir la responsabilidad del propio aprendizaje es esencial para el éxito académico, el bienestar mental y la ciudadanía responsable. La CPSAA dota al alumnado de recursos internos para afrontar la complejidad, los contratiempos y los cambios a lo largo de la vida.",
    keyDimensions: [
      { title: "Autoconciencia y regulación emocional", description: "Reconocer y gestionar las propias emociones, fortalezas y limitaciones." },
      { title: "Resiliencia y mentalidad de crecimiento", description: "Persistir ante los retos y ver los errores como oportunidades de aprendizaje." },
      { title: "Habilidades sociales y empatía", description: "Colaborar eficazmente, resolver conflictos de forma constructiva y mostrar empatía." },
      { title: "Estrategias de aprendizaje", description: "Planificar, supervisar y evaluar los propios procesos de aprendizaje." },
    ],
    descriptors: [
      {
        level: "Inicial (1.º–3.º de Primaria)",
        items: [
          "Identifica y nombra emociones básicas en sí mismo y en los demás.",
          "Pide ayuda cuando la necesita y acepta el apoyo de compañeros y adultos.",
          "Participa en actividades de grupo, respetando los turnos y compartiendo materiales.",
          "Comienza a identificar qué le resulta fácil o difícil en su aprendizaje.",
        ],
      },
      {
        level: "Primaria (4.º–6.º de Primaria)",
        items: [
          "Gestiona la frustración y persiste en tareas desafiantes.",
          "Trabaja en colaboración en grupos, contribuyendo de forma equitativa y escuchando a los demás.",
          "Reflexiona sobre su aprendizaje usando herramientas sencillas de autoevaluación.",
          "Establece objetivos de aprendizaje a corto plazo y supervisa su progreso.",
          "Resuelve conflictos menores con sus compañeros mediante la negociación y el compromiso.",
        ],
      },
      {
        level: "Secundaria (1.º–4.º de ESO)",
        items: [
          "Demuestra estrategias de autorregulación en situaciones académicas y sociales exigentes.",
          "Lidera y participa en proyectos colaborativos, gestionando roles y responsabilidades.",
          "Aplica de forma autónoma diversas estrategias de aprendizaje (mapas mentales, práctica espaciada, interrogación elaborativa).",
          "Evalúa críticamente su propio aprendizaje y ajusta las estrategias en consecuencia.",
          "Muestra empatía y adopta la perspectiva de los demás en situaciones sociales complejas.",
          "Desarrolla un plan de aprendizaje personal alineado con sus intereses y aspiraciones.",
        ],
      },
    ],
    classroomExamples: [
      "Llevar un diario de aprendizaje para reflexionar sobre el progreso y fijar objetivos semanales.",
      "Actividades de aprendizaje cooperativo estructurado con roles asignados.",
      "Círculos restaurativos para la resolución de conflictos.",
      "Rutinas de atención plena o registro emocional al inicio de las clases.",
      "Sesiones de retroalimentación entre iguales usando un protocolo estructurado.",
    ],
    linkedSubjects: ["Tutoría / Desarrollo Personal", "Todas las materias (transversal)", "Educación Física", "Ética", "Filosofía"],
  },

  CC: {
    name: "Competencia Ciudadana",
    overview:
      "La Competencia Ciudadana hace referencia a la capacidad de actuar como ciudadanos informados, responsables y activos. Engloba el conocimiento de las instituciones y los procesos democráticos, el respeto a los derechos humanos y el Estado de derecho, la comprensión crítica de los problemas sociales y políticos, y la disposición a participar de forma constructiva en la vida cívica a nivel local, nacional, europeo y global.",
    whyItMatters:
      "La democracia requiere ciudadanos informados y comprometidos. La competencia ciudadana equipa al alumnado para comprender cómo está organizada la sociedad, defender sus derechos y respetar los de los demás, abordar críticamente los problemas políticos y sociales, y contribuir a un mundo justo, pacífico y sostenible.",
    keyDimensions: [
      { title: "Conocimiento democrático", description: "Comprender las instituciones democráticas, los derechos humanos y el Estado de derecho." },
      { title: "Comprensión social crítica", description: "Analizar cuestiones sociales, políticas y económicas desde múltiples perspectivas." },
      { title: "Participación cívica", description: "Implicarse de forma activa y responsable en la vida escolar, local y cívica en sentido amplio." },
      { title: "Diálogo intercultural", description: "Respetar la diversidad y tender puentes entre diferencias culturales y sociales." },
    ],
    descriptors: [
      {
        level: "Inicial (1.º–3.º de Primaria)",
        items: [
          "Comprende y cumple las normas del aula y del centro, reconociendo su finalidad.",
          "Identifica derechos y responsabilidades básicos en la comunidad escolar.",
          "Muestra respeto por compañeros de distintos orígenes y culturas.",
          "Participa en procesos democráticos sencillos (votaciones de clase, consejo de clase).",
        ],
      },
      {
        level: "Primaria (4.º–6.º de Primaria)",
        items: [
          "Explica la estructura del gobierno local y nacional y sus funciones.",
          "Identifica ejemplos de derechos humanos y situaciones en que son vulnerados.",
          "Participa en estructuras democráticas del centro (consejo escolar, asambleas de clase).",
          "Analiza problemas sociales (desigualdad, discriminación) y propone respuestas constructivas.",
          "Demuestra solidaridad y respeto en sus interacciones con compañeros diversos.",
        ],
      },
      {
        level: "Secundaria (1.º–4.º de ESO)",
        items: [
          "Analiza el funcionamiento de los sistemas democráticos y sus fortalezas y debilidades.",
          "Evalúa cuestiones sociales, políticas y medioambientales actuales usando múltiples fuentes.",
          "Participa en acciones cívicas (campañas, peticiones, proyectos comunitarios) a nivel escolar o local.",
          "Defiende posiciones sobre cuestiones éticas y sociales con argumentos razonados, respetando la disidencia.",
          "Comprende el papel de los organismos internacionales (ONU, UE, Consejo de Europa) en la gobernanza global.",
          "Reflexiona sobre su propia identidad, valores y responsabilidades como ciudadano.",
        ],
      },
    ],
    classroomExamples: [
      "Simular un debate parlamentario sobre un tema social de actualidad.",
      "Investigar y presentar un estudio de caso sobre derechos humanos.",
      "Organizar una campaña de recaudación de fondos o sensibilización en el centro para una causa social.",
      "Analizar programas electorales y comparar posiciones políticas.",
      "Crear una constitución de clase o carta de derechos y responsabilidades.",
    ],
    linkedSubjects: ["Ciencias Sociales", "Historia", "Geografía", "Ética", "Filosofía", "Tutoría"],
  },

  CE: {
    name: "Competencia Emprendedora",
    overview:
      "La Competencia Emprendedora hace referencia a la capacidad de actuar ante oportunidades e ideas, transformándolas en valor para los demás. Engloba la creatividad, la iniciativa, la planificación, la gestión del riesgo y la capacidad de trabajar en colaboración para alcanzar objetivos. Se aplica no solo a los proyectos empresariales, sino a cualquier contexto en que se requiera una resolución de problemas proactiva y creativa: proyectos sociales, iniciativas comunitarias y desarrollo personal.",
    whyItMatters:
      "La capacidad de identificar oportunidades, tomar la iniciativa y llevar proyectos a buen término es valiosa en todos los ámbitos de la vida. La competencia emprendedora fomenta la creatividad, la resiliencia y el sentido de la agencia, empoderando al alumnado para moldear su propio futuro y contribuir positivamente a sus comunidades.",
    keyDimensions: [
      { title: "Creatividad e innovación", description: "Generar ideas y enfoques originales ante problemas y oportunidades." },
      { title: "Visión y planificación", description: "Establecer objetivos, planificar pasos y anticipar dificultades." },
      { title: "Iniciativa y gestión del riesgo", description: "Actuar de forma proactiva, tomar decisiones en situaciones de incertidumbre y aprender del fracaso." },
      { title: "Colaboración y liderazgo", description: "Trabajar con otros para alcanzar metas compartidas, motivar y organizar un equipo." },
    ],
    descriptors: [
      {
        level: "Inicial (1.º–3.º de Primaria)",
        items: [
          "Genera ideas creativas y prueba nuevos enfoques en las tareas.",
          "Completa proyectos de iniciativa propia con apoyo de adultos.",
          "Muestra disposición a intentarlo de nuevo tras cometer un error.",
          "Aporta ideas a las actividades de grupo y escucha las sugerencias de los demás.",
        ],
      },
      {
        level: "Primaria (4.º–6.º de Primaria)",
        items: [
          "Identifica un problema o necesidad en su centro o comunidad y propone una solución.",
          "Planifica un proyecto sencillo con pasos, recursos y un calendario.",
          "Trabaja en equipo para llevar a cabo un proyecto, asumiendo distintos roles.",
          "Evalúa los resultados de un proyecto e identifica qué podría mejorarse.",
          "Muestra resiliencia cuando los planes no salen como se esperaba.",
        ],
      },
      {
        level: "Secundaria (1.º–4.º de ESO)",
        items: [
          "Desarrolla y presenta un proyecto o iniciativa original que responde a una necesidad real.",
          "Aplica metodologías de design thinking o lean startup al desarrollo de proyectos.",
          "Gestiona recursos, plazos y dinámicas de equipo en un proyecto complejo.",
          "Evalúa el riesgo y toma decisiones informadas en situaciones de incertidumbre.",
          "Reflexiona críticamente sobre las dimensiones sociales y éticas de la actividad emprendedora.",
          "Demuestra liderazgo, adaptabilidad y mentalidad de crecimiento a lo largo del ciclo de vida de un proyecto.",
        ],
      },
    ],
    classroomExamples: [
      "Gestionar una miniempresa escolar (diseño de producto, producción, marketing, ventas).",
      "Reto de design thinking: rediseñar un espacio o servicio del centro.",
      "Presentar una idea de empresa social ante un panel de 'inversores'.",
      "Hackathon: resolver un problema comunitario usando tecnología en 24 horas.",
      "Entrevistar a emprendedores locales y reflexionar sobre sus trayectorias.",
    ],
    linkedSubjects: ["Tecnología", "Economía y Empresa", "Arte y Diseño", "Informática", "Tutoría", "Todas las materias (transversal)"],
  },

  CCEC: {
    name: "Competencia en Conciencia y Expresión Culturales",
    overview:
      "La Competencia en Conciencia y Expresión Culturales hace referencia a la capacidad de comprender y respetar la expresión creativa de ideas, experiencias y emociones a través del arte, la música, la literatura, el cine y otras formas culturales. Implica tanto la apreciación del patrimonio cultural y la expresión contemporánea, como la capacidad de crear y comunicarse a través de medios artísticos y culturales.",
    whyItMatters:
      "La cultura y las artes son centrales para la identidad humana, la cohesión social y la transmisión de valores entre generaciones. La CCEC permite al alumnado relacionarse con la diversidad cultural con curiosidad y respeto, expresarse de forma creativa y contribuir a la vida cultural de sus comunidades.",
    keyDimensions: [
      { title: "Conocimiento y apreciación cultural", description: "Comprender y apreciar el patrimonio artístico y cultural, pasado y presente." },
      { title: "Expresión creativa", description: "Expresar ideas, emociones y experiencias a través de una variedad de medios artísticos." },
      { title: "Análisis cultural crítico", description: "Interpretar y evaluar obras culturales y artísticas en su contexto social e histórico." },
      { title: "Diálogo intercultural", description: "Relacionarse con la diversidad cultural y reconocer el valor de las distintas tradiciones culturales." },
    ],
    descriptors: [
      {
        level: "Inicial (1.º–3.º de Primaria)",
        items: [
          "Explora y disfruta de diversas formas artísticas (música, artes visuales, teatro, danza).",
          "Crea obras artísticas sencillas que expresan ideas o sentimientos personales.",
          "Reconoce celebraciones y tradiciones culturales de su propia comunidad y de otras.",
          "Responde a obras de arte con curiosidad y reflexión personal sencilla.",
        ],
      },
      {
        level: "Primaria (4.º–6.º de Primaria)",
        items: [
          "Analiza obras de arte, música y literatura, identificando características y técnicas clave.",
          "Crea obras artísticas en distintos medios con creciente habilidad e intencionalidad.",
          "Compara tradiciones culturales y formas artísticas de distintos países y épocas.",
          "Participa en eventos culturales y actuaciones en el centro y en la comunidad.",
          "Reflexiona sobre cómo el arte y la cultura moldean y reflejan los valores e identidades sociales.",
        ],
      },
      {
        level: "Secundaria (1.º–4.º de ESO)",
        items: [
          "Analiza e interpreta obras artísticas y culturales complejas en su contexto histórico y social.",
          "Crea obras artísticas sofisticadas que demuestran habilidad técnica y voz propia.",
          "Evalúa el papel de la cultura y las artes en el cambio social y la formación de identidades.",
          "Se relaciona con la diversidad cultural de forma crítica y empática, cuestionando estereotipos.",
          "Reflexiona sobre su propia identidad cultural y su relación con tradiciones culturales más amplias.",
        ],
      },
    ],
    classroomExamples: [
      "Analizar una pintura, película u obra musical en su contexto histórico.",
      "Crear un proyecto artístico multimedia inspirado en un tema cultural.",
      "Asistir a una representación teatral o visita a un museo y escribir una reseña crítica.",
      "Explorar la música, la danza y las artes visuales de una cultura no europea.",
      "Organizar un festival cultural escolar que celebre la diversidad de la comunidad educativa.",
    ],
    linkedSubjects: ["Educación Plástica y Visual", "Música", "Artes Escénicas", "Lengua Castellana y Literatura", "Historia", "Ciencias Sociales"],
  },
};

/* ─── Catalan (CA) ─────────────────────────────────────────────────────────── */
export const COMPETENCY_DETAIL_CA: CompetencyTranslations = {
  CCL: {
    name: "Comunicació Lingüística",
    overview:
      "La competència en Comunicació Lingüística fa referència a la capacitat d'utilitzar la llengua —oral i escrita— com a instrument de comunicació, representació, interpretació i comprensió de la realitat. Engloba l'habilitat d'expressar i comprendre idees, sentiments, fets i opinions de forma oral i escrita, i d'interactuar lingüísticament de manera adequada, creativa i crítica en una àmplia varietat de contextos socioculturals i comunicatius.",
    whyItMatters:
      "La llengua és el mitjà principal a través del qual es produeix tot aprenentatge. Una sòlida competència lingüística permet a l'alumnat accedir al coneixement en totes les matèries, participar en la vida democràtica i desenvolupar la seva identitat personal i professional.",
    keyDimensions: [
      { title: "Comunicació oral", description: "Escolta, expressió oral i interacció conversacional en contextos formals i informals." },
      { title: "Comunicació escrita", description: "Comprensió lectora, escriptura per a diferents propòsits i audiències, i anàlisi de textos." },
      { title: "Comunicació multimodal", description: "Comprensió i producció de textos que combinen llengua amb imatges, so i formats digitals." },
      { title: "Ús crític del llenguatge", description: "Identificar biaixos, avaluar fonts i usar el llenguatge de forma ètica i responsable." },
    ],
    descriptors: [
      {
        level: "Inicial (1r–3r de Primària)",
        items: [
          "Escolta amb atenció i respon adequadament en converses senzilles.",
          "Llegeix textos breus amb comprensió i identifica la idea principal.",
          "Escriu oracions simples i paràgrafs curts amb puntuació bàsica.",
          "Reconeix que el llenguatge es pot usar per expressar sentiments i opinions.",
        ],
      },
      {
        level: "Primària (4t–6è de Primària)",
        items: [
          "Participa en debats en grup, respectant els torns i construint sobre les aportacions dels altres.",
          "Llegeix diversos tipus de textos (narratiu, informatiu, poètic) i identifica el propòsit i l'audiència.",
          "Planifica i escriu textos estructurats amb introducció, desenvolupament i conclusió.",
          "Identifica tècniques persuasives i avalua la fiabilitat de les fonts d'informació.",
          "Usa vocabulari de les diverses matèries amb precisió i exactitud.",
        ],
      },
      {
        level: "Secundària (1r–4t d'ESO)",
        items: [
          "Produeix i interpreta textos orals i escrits complexos en contextos acadèmics i socials.",
          "Analitza textos literaris i no literaris usant metallenguatge apropiat.",
          "Construeix arguments ben raonats per escrit i en debat, reconeixent contraarguments.",
          "Avalua les dimensions ideològiques i culturals de l'ús del llenguatge.",
          "Adapta el registre, el to i l'estil a diverses situacions comunicatives.",
          "Usa eines digitals per crear, compartir i avaluar críticament textos multimodals.",
        ],
      },
    ],
    classroomExamples: [
      "Debatre temes d'actualitat usant marcs d'argumentació estructurada.",
      "Escriure una carta persuasiva a una autoritat local sobre un problema mediambiental.",
      "Analitzar el llenguatge publicitari i identificar recursos retòrics.",
      "Crear un pòdcast o programa de ràdio de classe sobre un tema escollit per l'alumnat.",
      "Revisar textos escrits entre iguals usant una rúbrica alineada amb els descriptors de la CCL.",
    ],
    linkedSubjects: ["Llengua Catalana i Literatura", "Llengua Castellana i Literatura", "Llengües Estrangeres", "Ciències Socials", "Totes les matèries"],
  },

  CP: {
    name: "Competència Plurilingüe",
    overview:
      "La Competència Plurilingüe fa referència a la capacitat d'utilitzar diverses llengües de manera adequada i eficaç per a la comunicació, i de participar en interaccions multilingües. Implica una consciència de la diversitat lingüística, la capacitat de transferir coneixements lingüístics entre llengües i una actitud positiva envers l'aprenentatge d'idiomes i la diversitat cultural.",
    whyItMatters:
      "Espanya és un país lingüísticament divers amb diverses llengües cooficials, i el seu alumnat es desenvolupa en un món cada vegada més globalitzat. La competència plurilingüe permet accedir a un coneixement més ampli, construir ponts interculturals i participar plenament en la societat europea i global.",
    keyDimensions: [
      { title: "Consciència lingüística", description: "Comprendre com funcionen les llengües i les relacions entre elles." },
      { title: "Estratègies comunicatives", description: "Usar estratègies compensatòries quan no es té plena competència (p. ex., paràfrasi, alternança de codis)." },
      { title: "Competència intercultural", description: "Reconèixer i respectar les diferències culturals presents en l'ús de la llengua." },
      { title: "Transferència lingüística", description: "Aplicar el coneixement d'una llengua per donar suport a l'aprenentatge d'una altra." },
    ],
    descriptors: [
      {
        level: "Inicial (1r–3r de Primària)",
        items: [
          "Reconeix que les persones parlen diverses llengües i que això és normal i valuós.",
          "Comprèn i usa frases senzilles en una segona llengua en contextos familiars.",
          "Mostra curiositat per paraules d'altres llengües i cultures.",
        ],
      },
      {
        level: "Primària (4t–6è de Primària)",
        items: [
          "Es comunica en una segona llengua sobre temes familiars usant frases apreses i oracions simples.",
          "Identifica similituds i diferències entre la seva llengua materna i altres llengües.",
          "Mostra respecte pels parlants d'altres llengües i varietats lingüístiques.",
          "Usa el context i pistes visuals per inferir el significat en una segona llengua.",
        ],
      },
      {
        level: "Secundària (1r–4t d'ESO)",
        items: [
          "Es comunica eficaçment en dues o més llengües sobre una varietat de temes i contextos.",
          "Reflexiona sobre el seu propi procés d'aprenentatge de llengües i aplica estratègies eficaces.",
          "Analitza com els valors culturals i les visions del món es codifiquen en el llenguatge.",
          "Media entre llengües i cultures en situacions reals o simulades.",
          "Usa eines digitals per accedir, produir i compartir contingut en diverses llengües.",
        ],
      },
    ],
    classroomExamples: [
      "Classes d'Aprenentatge Integrat de Continguts i Llengua Estrangera (AICLE) en una segona llengua.",
      "Comparar expressions idiomàtiques en castellà, català i anglès.",
      "Intercanvis epistolars amb estudiants d'altres països europeus.",
      "Traduir un text breu i reflexionar sobre els reptes de la traducció.",
      "Investigar un tema usant fonts en dues llengües diferents.",
    ],
    linkedSubjects: ["Llengües Estrangeres (anglès, francès, alemany)", "Llengua Catalana i Literatura", "Llengua Castellana i Literatura", "Ciències Socials"],
  },

  STEM: {
    name: "Competència Matemàtica i en Ciència, Tecnologia i Enginyeria",
    overview:
      "La Competència STEM engloba la capacitat de formular, aplicar i interpretar les matemàtiques en una varietat de contextos, i de participar en la indagació científica, la resolució tecnològica de problemes i el pensament de disseny en enginyeria. Implica desenvolupar una mentalitat científica —formular preguntes, plantejar hipòtesis, recollir evidències i extreure conclusions— així com aplicar el raonament matemàtic a situacions del món real.",
    whyItMatters:
      "L'alfabetització matemàtica i científica és fonamental per a una ciutadania informada, el pensament crític i la participació en una economia impulsada per la tecnologia. La competència STEM permet a l'alumnat comprendre el món que l'envolta, prendre decisions basades en evidències i contribuir a la innovació i el desenvolupament sostenible.",
    keyDimensions: [
      { title: "Raonament matemàtic", description: "Usar el pensament lògic, l'abstracció i la demostració per resoldre problemes i comunicar idees matemàtiques." },
      { title: "Indagació científica", description: "Dissenyar i realitzar investigacions, analitzar dades i extreure conclusions basades en evidències." },
      { title: "Alfabetització tecnològica", description: "Comprendre com funciona la tecnologia i usar-la de forma responsable per resoldre problemes." },
      { title: "Disseny en enginyeria", description: "Aplicar un cicle de disseny-construcció-prova-millora per crear solucions a reptes reals." },
    ],
    descriptors: [
      {
        level: "Inicial (1r–3r de Primària)",
        items: [
          "Compta, ordena i compara nombres; realitza operacions aritmètiques bàsiques.",
          "Identifica formes, patrons i mesures senzilles en contextos quotidians.",
          "Formula preguntes sobre el món natural i realitza observacions simples.",
          "Usa eines i materials bàsics per construir estructures senzilles.",
        ],
      },
      {
        level: "Primària (4t–6è de Primària)",
        items: [
          "Resol problemes aritmètics de diversos passos i explica el raonament utilitzat.",
          "Recull, organitza i representa dades mitjançant taules i gràfics.",
          "Dissenya i realitza experiments científics senzills amb orientació del docent.",
          "Identifica relacions de causa i efecte en fenòmens naturals.",
          "Usa la tecnologia de forma intencionada per donar suport a l'aprenentatge i la resolució de problemes.",
        ],
      },
      {
        level: "Secundària (1r–4t d'ESO)",
        items: [
          "Aplica raonament algebraic, geomètric i estadístic per resoldre problemes complexos.",
          "Dissenya i realitza investigacions científiques independents, avaluant la metodologia.",
          "Interpreta i avalua críticament dades científiques, incloses les representacions als mitjans.",
          "Aplica principis de disseny en enginyeria per crear i provar solucions a problemes reals.",
          "Comprèn les implicacions socials, ètiques i mediambientals dels avenços científics i tecnològics.",
          "Usa eines digitals (fulls de càlcul, simulacions, programació) per modelar i analitzar fenòmens.",
        ],
      },
    ],
    classroomExamples: [
      "Dissenyar un pont amb materials reciclats i provar la seva capacitat de càrrega.",
      "Analitzar dades estadístiques reals (p. ex., dades climàtiques) per identificar tendències.",
      "Programar una simulació senzilla d'un sistema físic.",
      "Investigar les matemàtiques de la música (freqüència, proporcions, patrons).",
      "Avaluar articles de notícies sobre afirmacions científiques usant criteris basats en evidències.",
    ],
    linkedSubjects: ["Matemàtiques", "Ciències Naturals", "Física i Química", "Biologia i Geologia", "Tecnologia i Enginyeria", "Informàtica"],
  },

  CD: {
    name: "Competència Digital",
    overview:
      "La Competència Digital implica l'ús confiat, crític i responsable de les tecnologies digitals per a l'aprenentatge, el treball i la participació en la societat. Abasta cinc àrees: alfabetització en informació i dades, comunicació i col·laboració, creació de continguts digitals, seguretat i benestar, i resolució de problemes. També inclou la comprensió de les dimensions socials, ètiques i legals de la vida digital.",
    whyItMatters:
      "Les tecnologies digitals impregnen tots els aspectes de la vida moderna. La competència digital permet a l'alumnat navegar críticament pel panorama informatiu, protegir la seva privacitat i benestar en línia, crear continguts digitals significatius i participar com a ciutadans digitals actius i responsables.",
    keyDimensions: [
      { title: "Alfabetització en informació i dades", description: "Cercar, avaluar i gestionar informació i dades digitals." },
      { title: "Comunicació i col·laboració", description: "Interactuar, col·laborar i compartir a través de tecnologies digitals." },
      { title: "Creació de continguts digitals", description: "Crear i editar continguts digitals, comprenent els drets d'autor i les llicències." },
      { title: "Seguretat i benestar", description: "Protegir dispositius, dades, privacitat i salut mental en entorns digitals." },
      { title: "Resolució de problemes", description: "Usar eines digitals per resoldre problemes i identificar llacunes en la competència digital." },
    ],
    descriptors: [
      {
        level: "Inicial (1r–3r de Primària)",
        items: [
          "Usa dispositius digitals bàsics (tauleta, ordinador) de forma segura amb supervisió adulta.",
          "Cerca informació en línia amb orientació i identifica resultats rellevants.",
          "Crea continguts digitals senzills (dibuixos, textos curts) amb eines adequades a la seva edat.",
          "Comprèn les normes bàsiques de comportament segur i respectuós en línia.",
        ],
      },
      {
        level: "Primària (4t–6è de Primària)",
        items: [
          "Cerca, avalua i organitza informació digital de forma independent.",
          "Usa eines digitals per col·laborar amb els seus companys en projectes compartits.",
          "Crea continguts digitals multimodals (presentacions, vídeos, blocs) per a una audiència definida.",
          "Identifica riscos en entorns digitals (ciberassetjament, desinformació) i aplica estratègies de protecció.",
          "Comprèn conceptes bàsics de drets d'autor i ús responsable.",
        ],
      },
      {
        level: "Secundària (1r–4t d'ESO)",
        items: [
          "Avalua críticament fonts digitals quant a fiabilitat, biaix i propòsit.",
          "Usa plataformes digitals per col·laborar, comunicar-se i compartir coneixement de forma responsable.",
          "Crea continguts digitals sofisticats aplicant principis de disseny, accessibilitat i drets d'autor.",
          "Gestiona la identitat digital, la configuració de privacitat i les dades personals de forma conscient.",
          "Aplica el pensament computacional i la programació bàsica per resoldre problemes.",
          "Analitza les implicacions ètiques i socials de la IA, la recollida de dades i el biaix algorítmic.",
        ],
      },
    ],
    classroomExamples: [
      "Verificar la veracitat d'una publicació viral a les xarxes socials usant múltiples fonts.",
      "Col·laborar en un document o presentació compartida usant eines al núvol.",
      "Crear un documental curt o vídeo explicatiu sobre un tema curricular.",
      "Dissenyar un prototip senzill de lloc web o aplicació.",
      "Debatre sobre l'ètica de la IA, la recollida de dades i el biaix algorítmic.",
    ],
    linkedSubjects: ["Informàtica", "Tecnologia", "Totes les matèries (transversal)", "Ciències Socials", "Ètica"],
  },

  CPSAA: {
    name: "Competència Personal, Social i d'Aprendre a Aprendre",
    overview:
      "Aquesta competència integra tres dimensions interconnectades: el desenvolupament personal (autoconsciència, regulació emocional, resiliència), les habilitats socials (empatia, col·laboració, resolució de conflictes) i les estratègies metacognitives d'aprenentatge (planificació, supervisió i avaluació del propi aprenentatge). És fonamental per a l'aprenentatge al llarg de la vida i la participació activa en la societat.",
    whyItMatters:
      "La capacitat de conèixer-se a un mateix, relacionar-se constructivament amb els altres i assumir la responsabilitat del propi aprenentatge és essencial per a l'èxit acadèmic, el benestar mental i la ciutadania responsable. La CPSAA dota l'alumnat de recursos interns per afrontar la complexitat, els contratemps i els canvis al llarg de la vida.",
    keyDimensions: [
      { title: "Autoconsciència i regulació emocional", description: "Reconèixer i gestionar les pròpies emocions, fortaleses i limitacions." },
      { title: "Resiliència i mentalitat de creixement", description: "Persistir davant els reptes i veure els errors com a oportunitats d'aprenentatge." },
      { title: "Habilitats socials i empatia", description: "Col·laborar eficaçment, resoldre conflictes de forma constructiva i mostrar empatia." },
      { title: "Estratègies d'aprenentatge", description: "Planificar, supervisar i avaluar els propis processos d'aprenentatge." },
    ],
    descriptors: [
      {
        level: "Inicial (1r–3r de Primària)",
        items: [
          "Identifica i anomena emocions bàsiques en si mateix i en els altres.",
          "Demana ajuda quan la necessita i accepta el suport de companys i adults.",
          "Participa en activitats de grup, respectant els torns i compartint materials.",
          "Comença a identificar què li resulta fàcil o difícil en el seu aprenentatge.",
        ],
      },
      {
        level: "Primària (4t–6è de Primària)",
        items: [
          "Gestiona la frustració i persisteix en tasques desafiants.",
          "Treballa en col·laboració en grups, contribuint de forma equitativa i escoltant els altres.",
          "Reflexiona sobre el seu aprenentatge usant eines senzilles d'autoavaluació.",
          "Estableix objectius d'aprenentatge a curt termini i supervisa el seu progrés.",
          "Resol conflictes menors amb els seus companys mitjançant la negociació i el compromís.",
        ],
      },
      {
        level: "Secundària (1r–4t d'ESO)",
        items: [
          "Demostra estratègies d'autoregulació en situacions acadèmiques i socials exigents.",
          "Lidera i participa en projectes col·laboratius, gestionant rols i responsabilitats.",
          "Aplica de forma autònoma diverses estratègies d'aprenentatge (mapes mentals, pràctica espaïada, interrogació elaborativa).",
          "Avalua críticament el seu propi aprenentatge i ajusta les estratègies en conseqüència.",
          "Mostra empatia i adopta la perspectiva dels altres en situacions socials complexes.",
          "Desenvolupa un pla d'aprenentatge personal alineat amb els seus interessos i aspiracions.",
        ],
      },
    ],
    classroomExamples: [
      "Portar un diari d'aprenentatge per reflexionar sobre el progrés i fixar objectius setmanals.",
      "Activitats d'aprenentatge cooperatiu estructurat amb rols assignats.",
      "Cercles restauratius per a la resolució de conflictes.",
      "Rutines d'atenció plena o registre emocional a l'inici de les classes.",
      "Sessions de retroalimentació entre iguals usant un protocol estructurat.",
    ],
    linkedSubjects: ["Tutoria / Desenvolupament Personal", "Totes les matèries (transversal)", "Educació Física", "Ètica", "Filosofia"],
  },

  CC: {
    name: "Competència Ciutadana",
    overview:
      "La Competència Ciutadana fa referència a la capacitat d'actuar com a ciutadans informats, responsables i actius. Engloba el coneixement de les institucions i els processos democràtics, el respecte als drets humans i l'estat de dret, la comprensió crítica dels problemes socials i polítics, i la disposició a participar de forma constructiva en la vida cívica a nivell local, nacional, europeu i global.",
    whyItMatters:
      "La democràcia requereix ciutadans informats i compromesos. La competència ciutadana equipa l'alumnat per comprendre com està organitzada la societat, defensar els seus drets i respectar els dels altres, abordar críticament els problemes polítics i socials, i contribuir a un món just, pacífic i sostenible.",
    keyDimensions: [
      { title: "Coneixement democràtic", description: "Comprendre les institucions democràtiques, els drets humans i l'estat de dret." },
      { title: "Comprensió social crítica", description: "Analitzar qüestions socials, polítiques i econòmiques des de múltiples perspectives." },
      { title: "Participació cívica", description: "Implicar-se de forma activa i responsable en la vida escolar, local i cívica en sentit ampli." },
      { title: "Diàleg intercultural", description: "Respectar la diversitat i tendir ponts entre diferències culturals i socials." },
    ],
    descriptors: [
      {
        level: "Inicial (1r–3r de Primària)",
        items: [
          "Comprèn i compleix les normes de l'aula i del centre, reconeixent la seva finalitat.",
          "Identifica drets i responsabilitats bàsics en la comunitat escolar.",
          "Mostra respecte pels companys de diferents orígens i cultures.",
          "Participa en processos democràtics senzills (votacions de classe, consell de classe).",
        ],
      },
      {
        level: "Primària (4t–6è de Primària)",
        items: [
          "Explica l'estructura del govern local i nacional i les seves funcions.",
          "Identifica exemples de drets humans i situacions en què són vulnerats.",
          "Participa en estructures democràtiques del centre (consell escolar, assemblees de classe).",
          "Analitza problemes socials (desigualtat, discriminació) i proposa respostes constructives.",
          "Demostra solidaritat i respecte en les seves interaccions amb companys diversos.",
        ],
      },
      {
        level: "Secundària (1r–4t d'ESO)",
        items: [
          "Analitza el funcionament dels sistemes democràtics i les seves fortaleses i debilitats.",
          "Avalua qüestions socials, polítiques i mediambientals actuals usant múltiples fonts.",
          "Participa en accions cíviques (campanyes, peticions, projectes comunitaris) a nivell escolar o local.",
          "Defensa posicions sobre qüestions ètiques i socials amb arguments raonats, respectant la dissidència.",
          "Comprèn el paper dels organismes internacionals (ONU, UE, Consell d'Europa) en la governança global.",
          "Reflexiona sobre la seva pròpia identitat, valors i responsabilitats com a ciutadà.",
        ],
      },
    ],
    classroomExamples: [
      "Simular un debat parlamentari sobre un tema social d'actualitat.",
      "Investigar i presentar un estudi de cas sobre drets humans.",
      "Organitzar una campanya de recaptació de fons o sensibilització al centre per a una causa social.",
      "Analitzar programes electorals i comparar posicions polítiques.",
      "Crear una constitució de classe o carta de drets i responsabilitats.",
    ],
    linkedSubjects: ["Ciències Socials", "Història", "Geografia", "Ètica", "Filosofia", "Tutoria"],
  },

  CE: {
    name: "Competència Emprenedora",
    overview:
      "La Competència Emprenedora fa referència a la capacitat d'actuar davant oportunitats i idees, transformant-les en valor per als altres. Engloba la creativitat, la iniciativa, la planificació, la gestió del risc i la capacitat de treballar en col·laboració per assolir objectius. S'aplica no només als projectes empresarials, sinó a qualsevol context en què es requereixi una resolució de problemes proactiva i creativa: projectes socials, iniciatives comunitàries i desenvolupament personal.",
    whyItMatters:
      "La capacitat d'identificar oportunitats, prendre la iniciativa i portar projectes a bon terme és valuosa en tots els àmbits de la vida. La competència emprenedora fomenta la creativitat, la resiliència i el sentit de l'agència, empoderant l'alumnat per modelar el seu propi futur i contribuir positivament a les seves comunitats.",
    keyDimensions: [
      { title: "Creativitat i innovació", description: "Generar idees i enfocaments originals davant problemes i oportunitats." },
      { title: "Visió i planificació", description: "Establir objectius, planificar passos i anticipar dificultats." },
      { title: "Iniciativa i gestió del risc", description: "Actuar de forma proactiva, prendre decisions en situacions d'incertesa i aprendre del fracàs." },
      { title: "Col·laboració i lideratge", description: "Treballar amb altres per assolir metes compartides, motivar i organitzar un equip." },
    ],
    descriptors: [
      {
        level: "Inicial (1r–3r de Primària)",
        items: [
          "Genera idees creatives i prova nous enfocaments en les tasques.",
          "Completa projectes d'iniciativa pròpia amb suport d'adults.",
          "Mostra disposició a tornar-ho a intentar després de cometre un error.",
          "Aporta idees a les activitats de grup i escolta els suggeriments dels altres.",
        ],
      },
      {
        level: "Primària (4t–6è de Primària)",
        items: [
          "Identifica un problema o necessitat al seu centre o comunitat i proposa una solució.",
          "Planifica un projecte senzill amb passos, recursos i un calendari.",
          "Treballa en equip per dur a terme un projecte, assumint diferents rols.",
          "Avalua els resultats d'un projecte i identifica què podria millorar-se.",
          "Mostra resiliència quan els plans no surten com s'esperava.",
        ],
      },
      {
        level: "Secundària (1r–4t d'ESO)",
        items: [
          "Desenvolupa i presenta un projecte o iniciativa original que respon a una necessitat real.",
          "Aplica metodologies de design thinking o lean startup al desenvolupament de projectes.",
          "Gestiona recursos, terminis i dinàmiques d'equip en un projecte complex.",
          "Avalua el risc i pren decisions informades en situacions d'incertesa.",
          "Reflexiona críticament sobre les dimensions socials i ètiques de l'activitat emprenedora.",
          "Demostra lideratge, adaptabilitat i mentalitat de creixement al llarg del cicle de vida d'un projecte.",
        ],
      },
    ],
    classroomExamples: [
      "Gestionar una miniempresa escolar (disseny de producte, producció, màrqueting, vendes).",
      "Repte de design thinking: redissenyar un espai o servei del centre.",
      "Presentar una idea d'empresa social davant un panell d'«inversors».",
      "Hackathon: resoldre un problema comunitari usant tecnologia en 24 hores.",
      "Entrevistar emprenedors locals i reflexionar sobre les seves trajectòries.",
    ],
    linkedSubjects: ["Tecnologia", "Economia i Empresa", "Art i Disseny", "Informàtica", "Tutoria", "Totes les matèries (transversal)"],
  },

  CCEC: {
    name: "Competència en Consciència i Expressió Culturals",
    overview:
      "La Competència en Consciència i Expressió Culturals fa referència a la capacitat de comprendre i respectar l'expressió creativa d'idees, experiències i emocions a través de l'art, la música, la literatura, el cinema i altres formes culturals. Implica tant l'apreciació del patrimoni cultural i l'expressió contemporània, com la capacitat de crear i comunicar-se a través de mitjans artístics i culturals.",
    whyItMatters:
      "La cultura i les arts són centrals per a la identitat humana, la cohesió social i la transmissió de valors entre generacions. La CCEC permet a l'alumnat relacionar-se amb la diversitat cultural amb curiositat i respecte, expressar-se de forma creativa i contribuir a la vida cultural de les seves comunitats.",
    keyDimensions: [
      { title: "Coneixement i apreciació cultural", description: "Comprendre i apreciar el patrimoni artístic i cultural, passat i present." },
      { title: "Expressió creativa", description: "Expressar idees, emocions i experiències a través d'una varietat de mitjans artístics." },
      { title: "Anàlisi cultural crítica", description: "Interpretar i avaluar obres culturals i artístiques en el seu context social i històric." },
      { title: "Diàleg intercultural", description: "Relacionar-se amb la diversitat cultural i reconèixer el valor de les diverses tradicions culturals." },
    ],
    descriptors: [
      {
        level: "Inicial (1r–3r de Primària)",
        items: [
          "Explora i gaudeix de diverses formes artístiques (música, arts visuals, teatre, dansa).",
          "Crea obres artístiques senzilles que expressen idees o sentiments personals.",
          "Reconeix celebracions i tradicions culturals de la seva pròpia comunitat i d'altres.",
          "Respon a obres d'art amb curiositat i reflexió personal senzilla.",
        ],
      },
      {
        level: "Primària (4t–6è de Primària)",
        items: [
          "Analitza obres d'art, música i literatura, identificant característiques i tècniques clau.",
          "Crea obres artístiques en diversos mitjans amb creixent habilitat i intencionalitat.",
          "Compara tradicions culturals i formes artístiques de diferents països i èpoques.",
          "Participa en esdeveniments culturals i actuacions al centre i a la comunitat.",
          "Reflexiona sobre com l'art i la cultura modelen i reflecteixen els valors i identitats socials.",
        ],
      },
      {
        level: "Secundària (1r–4t d'ESO)",
        items: [
          "Analitza i interpreta obres artístiques i culturals complexes en el seu context històric i social.",
          "Crea obres artístiques sofisticades que demostren habilitat tècnica i veu pròpia.",
          "Avalua el paper de la cultura i les arts en el canvi social i la formació d'identitats.",
          "Es relaciona amb la diversitat cultural de forma crítica i empàtica, qüestionant estereotips.",
          "Reflexiona sobre la seva pròpia identitat cultural i la seva relació amb tradicions culturals més àmplies.",
        ],
      },
    ],
    classroomExamples: [
      "Analitzar una pintura, pel·lícula o obra musical en el seu context històric.",
      "Crear un projecte artístic multimèdia inspirat en un tema cultural.",
      "Assistir a una representació teatral o visita a un museu i escriure una ressenya crítica.",
      "Explorar la música, la dansa i les arts visuals d'una cultura no europea.",
      "Organitzar un festival cultural escolar que celebri la diversitat de la comunitat educativa.",
    ],
    linkedSubjects: ["Educació Visual i Plàstica", "Música", "Arts Escèniques", "Llengua Catalana i Literatura", "Història", "Ciències Socials"],
  },
};
