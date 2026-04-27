/**
 * seed-demo.mjs  –  Escola La Mercè demo data (2025-26 academic year)
 * Run: node scripts/seed-demo.mjs
 *
 * Column names verified against live DB schema.
 */
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';

const TENANT_ID   = 30059;
const DIRECTOR_ID = 1682391; // Carlos J. Blanch
const HOS_ID      = 1503258; // jferre75@xtec.cat
const ACADEMIC_YEAR = '2025-26';

// ── helpers ──────────────────────────────────────────────────────────────────
const d   = (y,m,day)         => new Date(Date.UTC(y,m-1,day));
const ts  = (y,m,day,h=0,mi=0) => new Date(Date.UTC(y,m-1,day,h,mi));
const iso = dt => dt.toISOString().slice(0,10);

const HOLIDAYS = new Set([
  '2025-09-11','2025-09-24','2025-10-13','2025-11-01',
  '2025-12-06','2025-12-08',
  '2025-12-22','2025-12-23','2025-12-24','2025-12-25','2025-12-26',
  '2025-12-29','2025-12-30','2025-12-31',
  '2026-01-01','2026-01-05','2026-01-06',
  '2026-02-16','2026-02-17','2026-02-18','2026-02-19','2026-02-20',
  '2026-04-02','2026-04-03','2026-04-06','2026-04-07','2026-04-08',
  '2026-04-09','2026-04-10','2026-05-01','2026-06-24',
]);
function schoolDays(from, to) {
  const days=[]; const cur=new Date(from);
  while(cur<=to){ const dow=cur.getDay(); const s=iso(cur);
    if(dow>=1&&dow<=5&&!HOLIDAYS.has(s)) days.push(s);
    cur.setUTCDate(cur.getUTCDate()+1); }
  return days;
}
const ALL_DAYS = schoolDays(d(2025,9,8), d(2026,6,19));

// ── teachers ─────────────────────────────────────────────────────────────────
const TEACHERS = [
  { name:'Maria Puig Soler',  email:'mpuig@escolalamerce.cat',   subjects:['Matemàtiques','Ciències Naturals'] },
  { name:'Jordi Mas Ferrer',  email:'jmas@escolalamerce.cat',    subjects:['Llengua Catalana','Llengua Castellana'] },
  { name:'Anna Vidal Roca',   email:'avidal@escolalamerce.cat',  subjects:['Anglès','Música'] },
  { name:'Pere Llopis Gómez', email:'pllopis@escolalamerce.cat', subjects:['Educació Física','Tutoria'] },
  { name:'Laia Bosch Prat',   email:'lbosch@escolalamerce.cat',  subjects:['Ciències Socials','Educació Visual'] },
  { name:'Miquel Riera Tort', email:'mriera@escolalamerce.cat',  subjects:['Tecnologia','Matemàtiques'] },
];

// ── class groups ──────────────────────────────────────────────────────────────
const CLASS_GROUPS = [
  { className:'P3-A', level:'Educació Infantil', yearGroup:'infantil', assessmentTitle:'Avaluació Infantil P3' },
  { className:'P4-A', level:'Educació Infantil', yearGroup:'infantil', assessmentTitle:'Avaluació Infantil P4' },
  { className:'P5-A', level:'Educació Infantil', yearGroup:'infantil', assessmentTitle:'Avaluació Infantil P5' },
  { className:'1r-A', level:'1r Primària',       yearGroup:'primary',  assessmentTitle:'Avaluació 1r Primària' },
  { className:'2n-A', level:'2n Primària',       yearGroup:'primary',  assessmentTitle:'Avaluació 2n Primària' },
  { className:'3r-A', level:'3r Primària',       yearGroup:'primary',  assessmentTitle:'Avaluació 3r Primària' },
  { className:'4t-A', level:'4t Primària',       yearGroup:'primary',  assessmentTitle:'Avaluació 4t Primària' },
  { className:'5è-A', level:'5è Primària',       yearGroup:'primary',  assessmentTitle:'Avaluació 5è Primària' },
  { className:'6è-A', level:'6è Primària',       yearGroup:'primary',  assessmentTitle:'Avaluació 6è Primària' },
];

const FIRST_NAMES = [
  'Arnau','Biel','Carla','Dani','Elena','Ferran','Gina','Hugo','Irene','Jan',
  'Klara','Lluc','Marta','Neus','Oriol','Paula','Quim','Rosa','Sergi','Tània',
  'Ugo','Vera','Xavi','Yara','Zoe','Alba','Bernat','Clara','David','Ester',
];
const LAST_NAMES = [
  'Puig','Mas','Vidal','Llopis','Bosch','Riera','Font','Sala','Prat','Soler',
  'Ferrer','Gómez','Roca','Tort','Pons','Coll','Vila','Martí','Serra','Camps',
];
function genStudents(gi, count) {
  return Array.from({length:count},(_,i)=>{
    const fn = FIRST_NAMES[(gi*7+i)%FIRST_NAMES.length];
    const l1 = LAST_NAMES[(gi*3+i)%LAST_NAMES.length];
    const l2 = LAST_NAMES[(gi*5+i+3)%LAST_NAMES.length];
    return { studentNumber:i+1, name:`${fn} ${l1} ${l2}`,
             email:`${fn.toLowerCase()}.${l1.toLowerCase()}${i+1}@alumnes.escolalamerce.cat` };
  });
}

// ── calendar events ───────────────────────────────────────────────────────────
const CAL_EVENTS = [
  {date:d(2025,9,11), type:'holiday', title:"Diada Nacional de Catalunya",      desc:"Festa nacional"},
  {date:d(2025,9,24), type:'holiday', title:"La Mercè",                          desc:"Festa major de Barcelona"},
  {date:d(2025,10,13),type:'holiday', title:"Festa Local",                       desc:"Dia festiu local"},
  {date:d(2025,11,1), type:'holiday', title:"Tots Sants",                        desc:"Festa nacional"},
  {date:d(2025,12,6), type:'holiday', title:"Dia de la Constitució",             desc:"Festa nacional"},
  {date:d(2025,12,8), type:'holiday', title:"La Immaculada",                     desc:"Festa nacional"},
  {date:d(2026,1,6),  type:'holiday', title:"Reis Mags",                         desc:"Festa nacional"},
  {date:d(2026,5,1),  type:'holiday', title:"Dia del Treball",                   desc:"Festa nacional"},
  {date:d(2025,9,8),  type:'special', title:"Primer dia de curs 2025-26",        desc:"Benvinguda a l'alumnat i famílies"},
  {date:d(2025,9,15), type:'event',   title:"Reunió de pares P3",                desc:"Reunió informativa per a les famílies de P3"},
  {date:d(2025,10,2), type:'excursion',title:"Sortida cultural 4t-A",            desc:"Visita al Museu d'Història de Catalunya"},
  {date:d(2025,10,20),type:'event',   title:"Castanyada",                        desc:"Activitat de la Castanyada per a tot el centre"},
  {date:d(2025,11,14),type:'event',   title:"Jornada de portes obertes",         desc:"Visita de famílies de futurs alumnes"},
  {date:d(2025,12,19),type:'special', title:"Festival de Nadal",                 desc:"Actuació de tots els cursos al gimnàs"},
  {date:d(2026,1,12), type:'event',   title:"Inici 2n trimestre",                desc:"Represa de les activitats lectives"},
  {date:d(2026,2,5),  type:'event',   title:"Carnestoltes",                      desc:"Desfilada de disfresses i activitats festives"},
  {date:d(2026,3,10), type:'event',   title:"Setmana Cultural",                  desc:"Activitats interdisciplinàries i tallers"},
  {date:d(2026,3,20), type:'special', title:"Inici 3r trimestre",                desc:"Darrer tram del curs escolar"},
  {date:d(2026,4,23), type:'special', title:"Sant Jordi",                        desc:"Festa del Llibre i la Rosa — mercat literari al pati"},
  {date:d(2026,5,15), type:'excursion',title:"Excursió de fi de curs 6è",        desc:"Excursió de fi de curs a la Vall d'Aran"},
  {date:d(2026,6,19), type:'special', title:"Últim dia de curs",                 desc:"Lliurament de notes i comiat de 6è"},
  {date:d(2025,11,24),type:'exam',    title:"Avaluació 1r trimestre — Matemàtiques 5è i 6è",    desc:"Prova escrita de matemàtiques"},
  {date:d(2025,11,25),type:'exam',    title:"Avaluació 1r trimestre — Llengua Catalana 5è i 6è",desc:"Prova escrita de llengua"},
  {date:d(2026,3,16), type:'exam',    title:"Avaluació 2n trimestre — Ciències Naturals 4t-6è", desc:"Prova escrita de ciències"},
  {date:d(2026,3,17), type:'exam',    title:"Avaluació 2n trimestre — Anglès 4t-6è",            desc:"Prova oral i escrita d'anglès"},
  {date:d(2026,5,25), type:'exam',    title:"Avaluació 3r trimestre — Matemàtiques 4t-6è",      desc:"Prova final de matemàtiques"},
  {date:d(2026,5,26), type:'exam',    title:"Avaluació 3r trimestre — Llengua Catalana 4t-6è",  desc:"Prova final de llengua"},
];

// ── lesson plans ──────────────────────────────────────────────────────────────
const LESSON_PLANS = [
  { title:"Els nombres fins al 1000", subject:"Matemàtiques", yearGroup:"3r Primària",
    lessonDate:"2025-09-15", duration:60,
    learningOutcomes:JSON.stringify(["Llegir i escriure nombres fins al 1000","Ordenar nombres","Identificar el valor posicional"]),
    procedures:JSON.stringify([
      {timing:"10 min",stage:"Introducció",activities:"Repàs dels nombres fins al 100 amb la pissarra digital.",grouping:"Gran grup"},
      {timing:"20 min",stage:"Desenvolupament",activities:"Presentació amb material manipulatiu (cubs base 10).",grouping:"Parelles"},
      {timing:"20 min",stage:"Pràctica",activities:"Fitxa de treball: escriure, llegir i ordenar nombres.",grouping:"Individual"},
      {timing:"10 min",stage:"Tancament",activities:"Posada en comú i reflexió.",grouping:"Gran grup"},
    ]), competencies:JSON.stringify(["STEM","CCL"]) },
  { title:"La narració: estructura i elements", subject:"Llengua Catalana", yearGroup:"4t Primària",
    lessonDate:"2025-09-22", duration:60,
    learningOutcomes:JSON.stringify(["Identificar les parts d'una narració","Reconèixer els personatges","Escriure un breu relat"]),
    procedures:JSON.stringify([
      {timing:"10 min",stage:"Motivació",activities:"Lectura en veu alta d'un conte curt.",grouping:"Gran grup"},
      {timing:"15 min",stage:"Anàlisi",activities:"Identificació col·lectiva de les parts del conte.",grouping:"Gran grup"},
      {timing:"25 min",stage:"Creació",activities:"Els alumnes escriuen el seu propi mini-conte.",grouping:"Individual"},
      {timing:"10 min",stage:"Compartir",activities:"Voluntaris llegeixen el seu conte.",grouping:"Gran grup"},
    ]), competencies:JSON.stringify(["CCL","CP"]) },
  { title:"The Solar System — Planets and their characteristics", subject:"Anglès", yearGroup:"5è Primària",
    lessonDate:"2025-10-06", duration:60,
    learningOutcomes:JSON.stringify(["Name and order the 8 planets","Describe key characteristics","Read an informational text"]),
    procedures:JSON.stringify([
      {timing:"10 min",stage:"Warm-up",activities:"Watch a 3-minute video about the Solar System.",grouping:"Whole class"},
      {timing:"20 min",stage:"Input",activities:"Teacher presents planets with flashcards.",grouping:"Whole class"},
      {timing:"20 min",stage:"Practice",activities:"Reading activity: match planets to descriptions.",grouping:"Pairs"},
      {timing:"10 min",stage:"Output",activities:"Students write 3 sentences about their favourite planet.",grouping:"Individual"},
    ]), competencies:JSON.stringify(["CCL","CP","STEM"]) },
  { title:"La Revolució Industrial: causes i conseqüències", subject:"Ciències Socials", yearGroup:"6è Primària",
    lessonDate:"2025-10-13", duration:60,
    learningOutcomes:JSON.stringify(["Identificar les causes principals","Descriure els canvis socials","Relacionar amb la situació actual"]),
    procedures:JSON.stringify([
      {timing:"5 min",stage:"Activació",activities:"Pregunta: Què sabeu sobre com es fabricaven les coses fa 200 anys?",grouping:"Gran grup"},
      {timing:"20 min",stage:"Explicació",activities:"Presentació amb imatges de fàbriques i màquines de vapor.",grouping:"Gran grup"},
      {timing:"25 min",stage:"Treball en grup",activities:"Cada grup investiga una causa o conseqüència.",grouping:"Grups de 4"},
      {timing:"10 min",stage:"Posada en comú",activities:"Exposicions dels grups. Debat.",grouping:"Gran grup"},
    ]), competencies:JSON.stringify(["CCEC","CC","CCL"]) },
  { title:"Joc cooperatiu: el circuit d'habilitats", subject:"Educació Física", yearGroup:"2n Primària",
    lessonDate:"2025-09-18", duration:60,
    learningOutcomes:JSON.stringify(["Participar en jocs cooperatius","Desenvolupar habilitats motrius bàsiques","Respectar les normes"]),
    procedures:JSON.stringify([
      {timing:"10 min",stage:"Escalfament",activities:"Joc de persecució lliure al pati.",grouping:"Gran grup"},
      {timing:"30 min",stage:"Circuit",activities:"Circuit de 5 estacions. Rotació cada 6 minuts.",grouping:"Grups de 5"},
      {timing:"15 min",stage:"Joc final",activities:"Joc cooperatiu: 'La cadena'.",grouping:"Gran grup"},
      {timing:"5 min",stage:"Relaxació",activities:"Estiraments i reflexió sobre el treball en equip.",grouping:"Gran grup"},
    ]), competencies:JSON.stringify(["CPSAA","CC"]) },
  { title:"Fraccions: concepte i representació", subject:"Matemàtiques", yearGroup:"4t Primària",
    lessonDate:"2025-11-03", duration:60,
    learningOutcomes:JSON.stringify(["Comprendre el concepte de fracció","Representar fraccions gràficament","Comparar fraccions"]),
    procedures:JSON.stringify([
      {timing:"10 min",stage:"Motivació",activities:"Repartir una pizza entre 4 alumnes. Quina part li toca?",grouping:"Gran grup"},
      {timing:"20 min",stage:"Conceptualització",activities:"Introducció del vocabulari: numerador, denominador.",grouping:"Gran grup"},
      {timing:"20 min",stage:"Pràctica",activities:"Fitxa: coloreja la fracció indicada.",grouping:"Individual"},
      {timing:"10 min",stage:"Síntesi",activities:"Joc de preguntes ràpides.",grouping:"Gran grup"},
    ]), competencies:JSON.stringify(["STEM"]) },
];

// ── assessment events ─────────────────────────────────────────────────────────
const ASSESSMENT_EVENTS = [
  {title:"Avaluació inicial — Matemàtiques",       eventType:"evaluation", yearGroup:"primary", subject:"Matemàtiques",    startDate:"2025-09-15",endDate:"2025-09-15",notes:"Prova diagnòstica inicial"},
  {title:"Avaluació inicial — Llengua Catalana",   eventType:"evaluation", yearGroup:"primary", subject:"Llengua Catalana",startDate:"2025-09-16",endDate:"2025-09-16",notes:"Prova diagnòstica inicial"},
  {title:"Reunió d'avaluació 1r trimestre",        eventType:"meeting",    yearGroup:null,      subject:null,             startDate:"2025-12-15",endDate:"2025-12-15",notes:"Reunió de cicle per tancar les notes del primer trimestre"},
  {title:"Lliurament notes 1r trimestre",          eventType:"deadline",   yearGroup:null,      subject:null,             startDate:"2025-12-19",endDate:"2025-12-19",notes:"Data límit per introduir les qualificacions"},
  {title:"Examen Matemàtiques 5è i 6è — 1r trim.", eventType:"exam",       yearGroup:"primary", subject:"Matemàtiques",    startDate:"2025-11-24",endDate:"2025-11-24",notes:"Prova escrita de matemàtiques del primer trimestre"},
  {title:"Examen Llengua Catalana 5è i 6è — 1r trim.",eventType:"exam",   yearGroup:"primary", subject:"Llengua Catalana",startDate:"2025-11-25",endDate:"2025-11-25",notes:"Prova escrita de llengua del primer trimestre"},
  {title:"Reunió d'avaluació 2n trimestre",        eventType:"meeting",    yearGroup:null,      subject:null,             startDate:"2026-03-23",endDate:"2026-03-23",notes:"Reunió de cicle per tancar les notes del segon trimestre"},
  {title:"Lliurament notes 2n trimestre",          eventType:"deadline",   yearGroup:null,      subject:null,             startDate:"2026-03-27",endDate:"2026-03-27",notes:"Data límit per introduir les qualificacions"},
  {title:"Examen Ciències Naturals 4t-6è — 2n trim.",eventType:"exam",    yearGroup:"primary", subject:"Ciències Naturals",startDate:"2026-03-16",endDate:"2026-03-16",notes:"Prova escrita de ciències del segon trimestre"},
  {title:"Examen Anglès 4t-6è — 2n trim.",         eventType:"exam",       yearGroup:"primary", subject:"Anglès",          startDate:"2026-03-17",endDate:"2026-03-17",notes:"Prova oral i escrita d'anglès del segon trimestre"},
  {title:"Reunió d'avaluació final",               eventType:"meeting",    yearGroup:null,      subject:null,             startDate:"2026-06-15",endDate:"2026-06-15",notes:"Reunió de claustre per tancar el curs"},
  {title:"Lliurament notes finals",                eventType:"deadline",   yearGroup:null,      subject:null,             startDate:"2026-06-19",endDate:"2026-06-19",notes:"Data límit per introduir les qualificacions finals"},
  {title:"Examen Matemàtiques 4t-6è — 3r trim.",  eventType:"exam",       yearGroup:"primary", subject:"Matemàtiques",    startDate:"2026-05-25",endDate:"2026-05-25",notes:"Prova final de matemàtiques"},
  {title:"Examen Llengua Catalana 4t-6è — 3r trim.",eventType:"exam",     yearGroup:"primary", subject:"Llengua Catalana",startDate:"2026-05-26",endDate:"2026-05-26",notes:"Prova final de llengua"},
];

// ── main ──────────────────────────────────────────────────────────────────────
async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  console.log('✅ Connected');

  // 1. Teachers
  console.log('\n👩‍🏫 Teachers…');
  const hash = await bcrypt.hash('Demo2025!', 10);
  const teacherIds = [];
  for (const t of TEACHERS) {
    const openId = `local_teacher_demo_${t.email.replace(/[^a-z0-9]/g,'_')}`;
    const [ex] = await conn.execute('SELECT id FROM users WHERE email=? AND tenantId=?',[t.email,TENANT_ID]);
    if (ex.length>0){ teacherIds.push(ex[0].id); console.log(`  ↩ ${t.name}`); continue; }
    const [r] = await conn.execute(
      `INSERT INTO users (openId,name,email,loginMethod,role,position,displayName,passwordHash,tenantId,mustChangePassword,isPermanent,createdAt,updatedAt,lastSignedIn)
       VALUES (?,?,?,'local','teacher','teacher',?,?,?,0,1,?,?,?)`,
      [openId,t.name,t.email,t.name,hash,TENANT_ID,ts(2025,9,1),ts(2025,9,1),ts(2025,9,8)]
    );
    teacherIds.push(r.insertId); console.log(`  ✓ ${t.name} id=${r.insertId}`);
  }

  // 2. Class groups
  console.log('\n🏫 Class groups…');
  const groupIds = [];
  for (let i=0;i<CLASS_GROUPS.length;i++) {
    const cg=CLASS_GROUPS[i]; const tutorId=teacherIds[i%teacherIds.length];
    const [ex]=await conn.execute('SELECT id FROM class_groups WHERE className=? AND tenantId=? AND academicYear=?',[cg.className,TENANT_ID,ACADEMIC_YEAR]);
    if(ex.length>0){ groupIds.push(ex[0].id); console.log(`  ↩ ${cg.className}`); continue; }
    const [r]=await conn.execute(
      `INSERT INTO class_groups (userId,className,level,assessmentTitle,yearGroup,academicYear,formTutorId,studentCount,tenantId,createdAt,updatedAt)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [DIRECTOR_ID,cg.className,cg.level,cg.assessmentTitle,cg.yearGroup,ACADEMIC_YEAR,tutorId,22,TENANT_ID,ts(2025,9,1),ts(2025,9,1)]
    );
    groupIds.push(r.insertId); console.log(`  ✓ ${cg.className} id=${r.insertId}`);
  }

  // 3. Students
  console.log('\n🎒 Students…');
  const COUNTS=[18,20,21,22,23,22,24,23,22];
  for(let gi=0;gi<groupIds.length;gi++){
    const gid=groupIds[gi];
    const [ex]=await conn.execute('SELECT COUNT(*) as n FROM group_students WHERE groupId=?',[gid]);
    if(ex[0].n>0){ console.log(`  ↩ group ${gid}`); continue; }
    const students=genStudents(gi,COUNTS[gi]||22);
    for(const s of students)
      await conn.execute('INSERT INTO group_students (groupId,studentNumber,name,email,createdAt) VALUES (?,?,?,?,?)',
        [gid,s.studentNumber,s.name,s.email,ts(2025,9,1)]);
    await conn.execute('UPDATE class_groups SET studentCount=? WHERE id=?',[students.length,gid]);
    console.log(`  ✓ ${students.length} students → group ${gid}`);
  }

  // 4. Timetable slots
  console.log('\n📅 Timetable slots…');
  const [exTs]=await conn.execute('SELECT COUNT(*) as n FROM timetable_slots WHERE tenantId=?',[TENANT_ID]);
  if(exTs[0].n===0){
    const PERIODS=[
      {n:1,s:'09:00',e:'10:00'},{n:2,s:'10:00',e:'11:00'},
      {n:3,s:'11:30',e:'12:30'},{n:4,s:'12:30',e:'13:30'},{n:5,s:'15:00',e:'16:00'},
    ];
    const SUBJS=['Matemàtiques','Llengua Catalana','Anglès','Ciències Naturals','Educació Física'];
    for(let gi=0;gi<groupIds.length;gi++){
      const gid=groupIds[gi]; const tid2=teacherIds[gi%teacherIds.length];
      for(let dow=1;dow<=5;dow++)
        for(let pi=0;pi<PERIODS.length;pi++){
          const p=PERIODS[pi];
          await conn.execute(
            `INSERT INTO timetable_slots (dayOfWeek,periodNumber,startTime,endTime,teacherId,classGroupId,subject,room,academicYear,tenantId,createdAt,updatedAt)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
            [dow,p.n,p.s,p.e,tid2,gid,SUBJS[pi],`Aula ${gi+1}`,ACADEMIC_YEAR,TENANT_ID,ts(2025,9,1),ts(2025,9,1)]
          );
        }
    }
    console.log('  ✓ Timetable slots created');
  } else console.log('  ↩ already exist');

  // 5. Teacher subjects
  console.log('\n📋 Teacher subjects…');
  const [exSub]=await conn.execute('SELECT COUNT(*) as n FROM teacher_subjects WHERE tenantId=?',[TENANT_ID]);
  if(exSub[0].n===0){
    for(let ti=0;ti<teacherIds.length;ti++)
      for(const subj of TEACHERS[ti].subjects)
        await conn.execute('INSERT INTO teacher_subjects (userId,subject,level,tenantId,createdAt,updatedAt) VALUES (?,?,?,?,?,?)',
          [teacherIds[ti],subj,'Primària',TENANT_ID,ts(2025,9,1),ts(2025,9,1)]);
    console.log('  ✓ Teacher subjects created');
  } else console.log('  ↩ already exist');

  // 6. Teacher schedule  (correct columns: semester,academic_year,day_of_week,lesson_slot,start_time,end_time,subject,group_name)
  console.log('\n🗓 Teacher schedule…');
  const [exSch]=await conn.execute('SELECT COUNT(*) as n FROM teacher_schedule WHERE tenantId=?',[TENANT_ID]);
  if(exSch[0].n===0){
    const SLOTS=[
      {slot:'1',s:'09:00',e:'10:00'},{slot:'2',s:'10:00',e:'11:00'},
      {slot:'3',s:'11:30',e:'12:30'},{slot:'4',s:'12:30',e:'13:30'},{slot:'5',s:'15:00',e:'16:00'},
    ];
    const DOW_NAMES=['monday','tuesday','wednesday','thursday','friday'];
    for(let ti=0;ti<teacherIds.length;ti++){
      const tid2=teacherIds[ti];
      for(let dow=0;dow<5;dow++)
        for(let pi=0;pi<SLOTS.length;pi++){
          const p=SLOTS[pi];
          const subj=TEACHERS[ti].subjects[pi%TEACHERS[ti].subjects.length];
          const grpName=CLASS_GROUPS[(ti+pi)%CLASS_GROUPS.length].className;
          await conn.execute(
            `INSERT INTO teacher_schedule (userId,semester,academic_year,day_of_week,lesson_slot,start_time,end_time,subject,group_name,tenantId,createdAt,updatedAt)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
            [tid2,'full_year',ACADEMIC_YEAR,DOW_NAMES[dow],p.slot,p.s,p.e,subj,grpName,TENANT_ID,ts(2025,9,1),ts(2025,9,1)]
          );
        }
    }
    console.log('  ✓ Teacher schedule created');
  } else console.log('  ↩ already exist');

  // 7. School calendar events
  console.log('\n📆 Calendar events…');
  const [exCal]=await conn.execute('SELECT COUNT(*) as n FROM school_calendar_events WHERE tenantId=?',[TENANT_ID]);
  if(exCal[0].n===0){
    for(const ev of CAL_EVENTS)
      await conn.execute(
        `INSERT INTO school_calendar_events (userId,academicYear,eventDate,eventType,title,description,tenantId,createdAt,updatedAt)
         VALUES (?,?,?,?,?,?,?,?,?)`,
        [DIRECTOR_ID,ACADEMIC_YEAR,ev.date,ev.type,ev.title,ev.desc||null,TENANT_ID,ts(2025,9,1),ts(2025,9,1)]
      );
    console.log(`  ✓ ${CAL_EVENTS.length} events`);
  } else console.log('  ↩ already exist');

  // 8. Lesson plans
  console.log('\n📝 Lesson plans…');
  const [exLp]=await conn.execute('SELECT COUNT(*) as n FROM lesson_plans WHERE tenantId=?',[TENANT_ID]);
  if(exLp[0].n===0){
    for(let li=0;li<LESSON_PLANS.length;li++){
      const lp=LESSON_PLANS[li]; const authorId=teacherIds[li%teacherIds.length];
      await conn.execute(
        `INSERT INTO lesson_plans (userId,title,subject,yearGroup,lessonDate,academicYear,duration,learningOutcomes,procedures,competencies,aiGenerated,tenantId,createdAt,updatedAt)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [authorId,lp.title,lp.subject,lp.yearGroup,lp.lessonDate,ACADEMIC_YEAR,lp.duration,
         lp.learningOutcomes,lp.procedures,lp.competencies,0,TENANT_ID,ts(2025,9,8),ts(2025,9,8)]
      );
    }
    console.log(`  ✓ ${LESSON_PLANS.length} lesson plans`);
  } else console.log('  ↩ already exist');

  // 9. Assessment events
  console.log('\n📊 Assessment events…');
  const [exAe]=await conn.execute('SELECT COUNT(*) as n FROM assessment_events WHERE tenantId=?',[TENANT_ID]);
  if(exAe[0].n===0){
    for(const ae of ASSESSMENT_EVENTS)
      await conn.execute(
        `INSERT INTO assessment_events (title,eventType,yearGroup,subject,startDate,endDate,notes,createdBy,academicYear,tenantId,createdAt,updatedAt)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
        [ae.title,ae.eventType,ae.yearGroup||null,ae.subject||null,ae.startDate,ae.endDate,ae.notes||null,HOS_ID,ACADEMIC_YEAR,TENANT_ID,ts(2025,9,1),ts(2025,9,1)]
      );
    console.log(`  ✓ ${ASSESSMENT_EVENTS.length} assessment events`);
  } else console.log('  ↩ already exist');

  // 10. Teacher attendance  (column: att_status)
  console.log('\n🏥 Teacher attendance…');
  const [exTa]=await conn.execute('SELECT COUNT(*) as n FROM teacher_attendance WHERE tenantId=?',[TENANT_ID]);
  if(exTa[0].n===0){
    const today=new Date();
    const pastDays=ALL_DAYS.filter(d2=>new Date(d2)<=today).slice(0,120);
    const ABSENT={
      0:['2025-10-08','2025-11-12','2026-01-20'],
      1:['2025-09-25','2026-02-03'],
      2:['2025-10-22','2025-12-10','2026-03-05'],
      3:['2025-11-05','2026-01-14'],
      4:['2025-10-15','2025-12-03','2026-02-18'],
      5:['2025-09-17','2026-01-28','2026-03-11'],
    };
    for(let ti=0;ti<teacherIds.length;ti++){
      const tid2=teacherIds[ti]; const abs=new Set(ABSENT[ti]||[]);
      for(const day of pastDays){
        const status=abs.has(day)?'absent_notified':'present';
        const parts=day.split('-').map(Number);
        const checkIn=abs.has(day)?null:ts(parts[0],parts[1],parts[2],8,45);
        await conn.execute(
          `INSERT INTO teacher_attendance (userId,attendanceDate,att_status,checkInAt,tenantId,createdAt,updatedAt)
           VALUES (?,?,?,?,?,?,?)`,
          [tid2,day,status,checkIn,TENANT_ID,ts(parts[0],parts[1],parts[2]),ts(parts[0],parts[1],parts[2])]
        );
      }
    }
    console.log('  ✓ Teacher attendance created');
  } else console.log('  ↩ already exist');

  // 11. Absence notifications  (column: absence_status)
  console.log('\n📬 Absence notifications…');
  const [exAn]=await conn.execute('SELECT COUNT(*) as n FROM teacher_absence_notifications WHERE tenantId=?',[TENANT_ID]);
  if(exAn[0].n===0){
    const absences=[
      {uid:teacherIds[0],date:'2025-10-08',reason:'Malaltia (grip)',          reviewedAt:ts(2025,10,7)},
      {uid:teacherIds[0],date:'2025-11-12',reason:'Cita mèdica especialista', reviewedAt:ts(2025,11,11)},
      {uid:teacherIds[1],date:'2025-09-25',reason:'Assumptes personals',      reviewedAt:ts(2025,9,24)},
      {uid:teacherIds[2],date:'2025-10-22',reason:'Formació docent',          reviewedAt:ts(2025,10,21)},
      {uid:teacherIds[2],date:'2025-12-10',reason:'Malaltia',                 reviewedAt:ts(2025,12,9)},
      {uid:teacherIds[3],date:'2025-11-05',reason:'Cita mèdica',              reviewedAt:ts(2025,11,4)},
      {uid:teacherIds[4],date:'2025-10-15',reason:'Malaltia (gastroenteritis)',reviewedAt:ts(2025,10,14)},
      {uid:teacherIds[5],date:'2025-09-17',reason:'Assumptes familiars urgents',reviewedAt:ts(2025,9,16)},
    ];
    for(const a of absences)
      await conn.execute(
        `INSERT INTO teacher_absence_notifications (userId,absenceDate,reason,absence_status,reviewedByUserId,reviewedAt,reviewNote,tenantId,createdAt,updatedAt)
         VALUES (?,?,?,'approved',?,?,?,?,?,?)`,
        [a.uid,a.date,a.reason,DIRECTOR_ID,a.reviewedAt,'Aprovat per la direcció',TENANT_ID,a.reviewedAt,a.reviewedAt]
      );
    console.log(`  ✓ ${absences.length} absence notifications`);
  } else console.log('  ↩ already exist');

  // 12. Class register + cover assignments
  // class_register columns: id,classGroupId,lessonDate,assignedTeacherId,markedByTeacherId,markedAt,isAbsence,absence_reason,notes,tenantId,createdAt,updatedAt
  // cover_assignment columns: id,registerId,coverTeacherId,confirmedByDirectorId,confirmedAt,cover_status,paybackScheduled,aiReasoning,tenantId,createdAt,updatedAt
  console.log('\n📋 Class register + cover assignments…');
  const [exCr]=await conn.execute('SELECT COUNT(*) as n FROM class_register WHERE tenantId=?',[TENANT_ID]);
  if(exCr[0].n===0){
    const scenarios=[
      {ti:0,date:'2025-10-08',coverTi:1},{ti:0,date:'2025-11-12',coverTi:2},
      {ti:1,date:'2025-09-25',coverTi:3},{ti:2,date:'2025-10-22',coverTi:4},
      {ti:2,date:'2025-12-10',coverTi:5},{ti:3,date:'2025-11-05',coverTi:0},
      {ti:4,date:'2025-10-15',coverTi:1},{ti:5,date:'2025-09-17',coverTi:2},
    ];
    for(const sc of scenarios){
      const absentId=teacherIds[sc.ti]; const coverId=teacherIds[sc.coverTi];
      const gid=groupIds[sc.ti%groupIds.length];
      const parts=sc.date.split('-').map(Number);
      const [rr]=await conn.execute(
        `INSERT INTO class_register (classGroupId,lessonDate,assignedTeacherId,markedByTeacherId,markedAt,isAbsence,absence_reason,notes,tenantId,createdAt,updatedAt)
         VALUES (?,?,?,?,?,1,'absent','Absent — cobert per substitut',?,?,?)`,
        [gid,sc.date,absentId,DIRECTOR_ID,ts(parts[0],parts[1],parts[2],9,0),TENANT_ID,
         ts(parts[0],parts[1],parts[2]),ts(parts[0],parts[1],parts[2])]
      );
      await conn.execute(
        `INSERT INTO cover_assignment (registerId,coverTeacherId,confirmedByDirectorId,confirmedAt,cover_status,paybackScheduled,aiReasoning,tenantId,createdAt,updatedAt)
         VALUES (?,?,?,?,'confirmed',0,'Assignació automàtica per disponibilitat horària',?,?,?)`,
        [rr.insertId,coverId,DIRECTOR_ID,ts(parts[0],parts[1],parts[2],8,30),TENANT_ID,
         ts(parts[0],parts[1],parts[2]),ts(parts[0],parts[1],parts[2])]
      );
    }
    console.log(`  ✓ ${scenarios.length} register entries + cover assignments`);
  } else console.log('  ↩ already exist');

  // 13. Student attendance (first 30 school days, first 3 groups)
  console.log('\n📝 Student attendance (sample)…');
  const [exAr]=await conn.execute('SELECT COUNT(*) as n FROM attendance_records WHERE classGroupId=?',[groupIds[0]]);
  if(exAr[0].n===0){
    const sampleDays=ALL_DAYS.slice(0,30);
    for(let gi=0;gi<Math.min(3,groupIds.length);gi++){
      const gid=groupIds[gi];
      const [studs]=await conn.execute('SELECT id FROM group_students WHERE groupId=? LIMIT 25',[gid]);
      for(const s of studs)
        for(let di=0;di<sampleDays.length;di++){
          const rand=(gi*100+s.id+di)%100;
          const status=rand<3?'absent':rand<5?'late':'present';
          const parts=sampleDays[di].split('-').map(Number);
          await conn.execute(
            'INSERT INTO attendance_records (classGroupId,studentId,date,status,recordedBy,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?)',
            [gid,s.id,sampleDays[di],status,teacherIds[gi%teacherIds.length],
             ts(parts[0],parts[1],parts[2]),ts(parts[0],parts[1],parts[2])]
          );
        }
      console.log(`  ✓ Attendance for group ${gid} (${studs.length} students × ${sampleDays.length} days)`);
    }
  } else console.log('  ↩ already exist');

  await conn.end();
  console.log('\n🎉 Demo seed complete!');
  console.log('\nTeacher demo accounts (password: Demo2025!):');
  TEACHERS.forEach(t=>console.log(`  ${t.name.padEnd(22)} ${t.email}`));
}

main().catch(e=>{ console.error('❌',e.message); process.exit(1); });
