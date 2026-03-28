# SEBA AI Studio – Project TODO

## Knowledge Bank
- [x] Python build script at /home/ubuntu/build_sebasnap_knowledge.py
- [x] TypeScript knowledge bank at server/knowledge/lomloeKnowledgeBank.ts (all 8 competencies × 3 year groups = 24 blocks)
- [x] Explanation field on every question (96 questions with explanations)

## Server / API
- [x] tRPC procedure: lomloe.getQuestions (filter by competency + yearGroup)
- [x] tRPC procedure: lomloe.getStats (coverage metrics for admin)
- [x] tRPC procedure: lomloe.chat (AI chat with knowledge bank context)
- [x] tRPC procedure: materials.create (AI-generates activity from topic + type)
- [x] tRPC procedure: materials.list (list saved materials per user)
- [x] tRPC procedure: materials.get (fetch single material)
- [x] tRPC procedure: materials.delete (delete material)
- [x] tRPC procedure: materials.saveSession (save practice session)
- [x] tRPC procedure: materials.getMyProgress (session history + chart data)

## Client – Core UI
- [x] Global design tokens in index.css (SEBA brand colours, fonts)
- [x] App.tsx routes: /, /practice, /admin, /create, /my-materials, /materials/:id, /progress
- [x] Home page with hero, competency overview cards, and CTA
- [x] Competency selector component (filter by code + year group)
- [x] NavBar Teacher dropdown with Create, My Materials, Admin, Progress links

## Client – AI Chat
- [x] AI chat page with custom chat UI
- [x] LLM responses with LOMLOE knowledge context
- [x] Out-of-scope question handling (advise user politely)

## Client – Practice Mode
- [x] Practice page: question display with 4-option MCQ
- [x] Answer validation with correct/incorrect feedback
- [x] Explanation shown after answer
- [x] Score tracker per session
- [x] Session auto-save when Practice Mode completes

## Client – Admin Dashboard
- [x] Admin route with knowledge bank stats
- [x] Knowledge bank statistics table (questions per competency/year group)
- [x] Coverage metrics visualisation (bar chart)

## Client – Teaching Materials Creator
- [x] Create page: activity type selector (quiz, slides, crossword, missing words, wordsearch, flashcards)
- [x] Topic input field with LOMLOE context selector
- [x] AI generation via tRPC materials.create procedure
- [x] Material viewer: quiz (interactive MCQ + explanations)
- [x] Material viewer: slides (slide deck with speaker notes + image suggestions)
- [x] Material viewer: crossword (clues + answer key)
- [x] Material viewer: missing words (fill-in-the-blank with hints + reveal)
- [x] Material viewer: wordsearch (word list + grid info)
- [x] Material viewer: flashcards (flip cards with competency hint)
- [x] My Materials library page (list, open, delete)
- [x] Print/download button on material view

## Client – Progress Tracker
- [x] Progress page with summary stats and bar chart by competency
- [x] Recent sessions list with score and date

## Database
- [x] practice_sessions table (migration applied)
- [x] teaching_materials table (migration applied)

## Quality
- [x] Vitest tests: 32/32 passing (3 test files)
- [x] TypeScript 0-error check (npx tsc --noEmit)
- [x] Production build succeeds

## Landing Page Copy Fix
- [x] Change hero heading 'Learning' to 'Teaching' on Home page

## Scheduled Refresh
- [x] Schedule nightly cron at 04:00 to run build_sebasnap_knowledge.py and rebuild knowledge bank

## LOMLOE Logo Placement
- [x] Upload lomloe.png to CDN and obtain public URL
- [x] Place LOMLOE logo in Home page hero section (below CTAs)
- [x] Add site footer component with LOMLOE logo and 'Powered by SEBA' text
- [x] Include footer on all pages via App.tsx layout

## Hero Background Image
- [x] Generate photorealistic hero background image (AI classroom / education theme)
- [x] Upload to CDN and apply to hero section with dark overlay for text readability
- [x] Ensure background is fixed/static while content scrolls

## Bug Fix – Practice Mode Explanation Mismatch
- [x] Diagnose why explanation text does not match the correct answer for the current question
- [x] Fix explanation alignment so it always corresponds to the displayed question's correct answer

## Mobile Layout Improvements
- [x] NavBar: add hamburger menu for mobile, hide desktop nav links on small screens
- [x] Home: fix hero text sizing, LOMLOE logo size, competency cards grid on mobile
- [x] Practice: ensure question cards, option buttons, and feedback panels are full-width on mobile
- [x] Chat: fix chat input and message bubbles for small screens
- [x] Progress: fix bar chart overflow and stats cards on mobile
- [x] Create: fix activity type selector grid and form layout on mobile
- [x] MyMaterials: fix materials grid and card layout on mobile
- [x] Admin: fix stats table and coverage chart on mobile
- [x] Footer: ensure footer stacks vertically and is readable on mobile

## App Name Rename
- [x] Rename "SEBA AI" to "SEBA AI | TA" in NavBar logo text
- [x] Rename in HTML <title> tag (client/index.html)
- [x] Rename in any other visible references (Footer, Chat greeting)

## Teaching Materials – Rich Content & Export
- [x] Upgrade LLM prompts for all 6 activity types: quiz, slides, crossword, missing_words, wordsearch, flashcards
- [x] Quiz: generate 10 MCQ questions with 4 options, correct answer, and explanation per question
- [x] Slides: generate 8–10 slides with title, body content, speaker notes, and key vocabulary per slide
- [x] Crossword: generate 10–15 clue/answer pairs with a proper grid layout (across/down)
- [x] Missing words: generate a passage with 8–12 blanked words and a word bank
- [x] Wordsearch: generate 10–15 hidden words with clues, arranged in a proper grid
- [x] Flashcards: generate 12–16 term/definition pairs with competency tags
- [x] MaterialView: render each type with full rich UI (interactive where appropriate)
- [x] Add Print button (browser print with print-optimised CSS)
- [x] Add PDF download (jsPDF + html2canvas)
- [x] Add Word (.docx) download (docx npm package)
- [x] Add PNG download (html2canvas screenshot)
- [x] Quiz/crossword/missing_words: print two versions (with answers and without answers)
- [x] Crossword grid: grey cells, larger numbers (200%), double line thickness
- [x] Q&A without-answers sheet: single line per question (not three lines)
- [x] Wordsearch: arrange keywords in proper grid

## Create a Presentation Feature
- [x] New page /presentation with heading, topic, subject, format inputs
- [x] AI generates cover slide + 8-10 content slides with competency tags and image suggestions
- [x] Paginated slide preview with thumbnail navigation
- [x] Download as Word (.docx), PDF, PNG, and Print
- [x] Teacher dropdown link: "Presentation" added to NavBar
- [x] Presentations saved to My Materials library (shared)
- [x] After generation, export options shown (Word, PDF, PNG, Print)

## Host a Class Challenge Feature
- [x] Teacher creates challenge with room code (6-char), selects competency + year group + question count
- [x] Students join via /join?code=XXXXXX on their phones
- [x] Real-time question display with 4 answer options and countdown timer
- [x] Live leaderboard updated after each question
- [x] Teacher controls: start, next question, end session
- [x] Session results saved to DB per student
- [x] Teacher dropdown link: "Class Challenge" (done)

## Sample Questions by Category Page
- [x] New page /questions with browsable library of all 96 questions
- [x] Filter by competency code (CCL, CP, STEM, CD, CPSAA, CC, CE, CCEC)
- [x] Filter by year group (junior, primary, secondary)
- [x] Print worksheet (with answers version + without answers version)
- [x] Teacher dropdown link: "Question Library" (done)

## Per-Page Background Treatments
- [x] Home: photorealistic classroom (done)
- [x] AI Chat: deep indigo/violet gradient (done)
- [x] Practice: warm amber/orange gradient (done)
- [x] Progress: teal/emerald gradient (done)
- [x] Create Materials: lavender/purple gradient (done)
- [x] My Materials: warm slate/blue-grey gradient (done)
- [x] Admin: dark navy/charcoal gradient (done)
- [x] Presentation: royal blue gradient (done — applied when page built)
- [x] Class Challenge: deep gold/amber dark gradient (done)
- [x] Sample Questions: light blue/indigo gradient (done)

## Follow-up: In-place Slide Editing
- [x] Click slide title to edit it inline (contentEditable or input swap)
- [x] Click slide body text to edit it inline
- [x] Click speaker notes to edit inline
- [x] Save edits to local state so exports reflect changes

## Follow-up: Derive Activity from Presentation
- [x] "Generate Quiz" button after slide generation — creates 10-question MCQ from slide content
- [x] "Generate Fill-in-the-blank" button — creates missing-words worksheet from slide content
- [x] Derived material opens in MaterialView for review and export

## Follow-up: Language Toggle (EN / ES / CA)
- [x] i18n context/hook with EN, ES (Spanish), CA (Catalan) translations
- [x] Default language auto-detected from browser locale
- [x] Language toggle button in NavBar (flag or text: EN / ES / CA)
- [x] Translate NavBar labels
- [x] Translate Home page hero, stats bar, competency cards, CTA buttons
- [x] Translate Practice page setup, question UI, feedback, score card
- [x] Translate Chat page header and placeholder text
- [x] Translate Progress page headings and stats
- [x] Translate Create page activity labels and form fields
- [x] Translate My Materials page headings and action buttons
- [x] Translate Admin page headings and table headers
- [x] Translate Footer text
- [x] Translate Presentation page form labels and export buttons
- [x] Translate Class Challenge page labels
- [x] Translate Question Library page labels and filters
