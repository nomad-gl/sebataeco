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

## Bug: Some text does not change language
- [x] Audit all pages/components for remaining hardcoded English strings
- [x] Fix CompetencySelector hardcoded labels (competency names, year group labels)
- [x] Fix Home.tsx competency card names and descriptions
- [x] Fix any other components with hardcoded strings not using t()

## Bug: Presentation page SelectItem empty value crash
- [x] Fix SelectItem value="" on "Any competency" option in Presentation.tsx (Radix UI forbids empty string values)

## Improvement: Wordsearch layout
- [x] Move word list below the grid in the wordsearch viewer
- [x] Add adequate vertical spacing between the grid and the word list

## Feature: Use saved materials in Class Challenge
- [x] Add material picker to Challenge creation form (select from My Materials)
- [x] Unlock all activity-type options when creating a challenge (not just MCQ from knowledge bank)
- [x] Extract questions from quiz materials for challenge use
- [x] Add "Use in Challenge" button on MyMaterials page
- [x] Add "Use in Challenge" button on MaterialView page (quiz type)
- [x] Pass selected material questions to challenge room instead of knowledge bank questions
- [x] Update server challenge procedures to accept material-sourced questions

## Feature: Improved Challenge Lobby & Join Flow
- [x] Lobby: show QR code for students to scan and join
- [x] Lobby: show shareable join URL with room code pre-filled
- [x] Lobby: live participant list with join animations and participant count
- [x] Lobby: clear "Start Game" button that only activates when at least 1 student has joined
- [x] Join page: cleaner room-code entry with auto-uppercase and 6-char limit
- [x] Join page: nickname input (required before joining)
- [x] Join page: waiting room with live participant count and "Game starting..." transition
- [x] Join page: smooth redirect when teacher starts the game

## Feature: Class Groups Management
- [x] Add class_groups table (id, userId, className, level, assessmentTitle, createdAt)
- [x] Add group_students table (id, groupId, studentNumber, name, email, createdAt)
- [x] Add group_messages table (id, groupId, userId, subject, body, sentAt)
- [x] Add group_challenge_log table (id, groupId, challengeId, competencies, createdAt)
- [x] Server: create/list/delete group procedures
- [x] Server: add/remove/list students in group procedures
- [x] Server: send group message procedure (log to DB)
- [x] Server: list challenge history for group with competencies and date
- [x] UI: Groups page with group list and detail panel
- [x] UI: Create group form (class name, level, assessment title)
- [x] UI: Student roster with auto-numbering, name + school email
- [x] UI: Send group alert/message panel (subject + body)
- [x] UI: Challenge history tab with date stamps and competency badges
- [x] Wire Groups page into NavBar Teacher menu
- [x] Add i18n keys for all new Groups strings (EN/ES/CA)
- [x] Link challenge creation to group (select group when creating challenge)

## Feature: Individual & Group Progress Tracking
- [x] DB schema: student_progress table (student scores per challenge per competency)
- [x] DB schema: assignments table (teacher-created daily/weekly tasks per group)
- [x] DB schema: assignment_completions table (per-student completion records)
- [x] Server: log challenge score per student procedure
- [x] Server: create/list/complete assignments procedures
- [x] Server: generate AI progress report per student (strengths, weaknesses, growth areas)
- [x] Server: generate AI group summary report
- [x] StudentProgress page: competency radar/bar chart, score history timeline, assignment completion tracker
- [x] StudentProgress page: AI-generated individual report with LOMLOE grade, strengths, weaknesses, growth areas
- [x] GroupProgress page: class summary table with per-student competency scores
- [x] GroupProgress page: competency heatmap across all students
- [x] GroupProgress page: ranked leaderboard with overall LOMLOE grade
- [x] GroupProgress page: AI group summary report
- [x] Wire student row in Groups page to StudentProgress page
- [x] Add i18n keys for all new progress tracking strings (EN/ES/CA)

## Feature: Auto-log Challenge Scores to Group Progress
- [x] After challenge ends, show "Save to Group" dialog on results screen
- [x] Let teacher pick which group to associate the results with
- [x] Write student_progress rows for each participant matched by name/number
- [x] Record challenge in group_challenge_log with competencies covered

## Feature: Assignment Due-Date Reminders
- [x] Add checkOverdueAssignments server procedure
- [x] Call notifyOwner when an assignment is past due with no completions
- [x] Add "Enable reminders" toggle per assignment in the UI
- [x] Wire reminder check to a periodic server-side call (on page load or cron)

## Feature: PDF Export of Student Progress Report
- [x] Add server-side PDF generation procedure (html-to-pdf / pdfkit)
- [x] Include competency scores, assignment history, and AI report text in PDF
- [x] Add "Download PDF" button on the AI Report tab in StudentProgress page
- [x] Translate new PDF export button label (EN/ES/CA)

## Feature: Teacher-only answer reveal in Class Challenge
- [x] Gate "Show Answers" button in Challenge live view so only the teacher (room owner) can trigger it
- [x] Students see a "Waiting for teacher..." state when answers are not yet revealed
- [x] Reveal state is broadcast to all participants via the existing poll mechanism

## Feature: Import from sebasnap.com admin area
- [x] Add Import button on My Materials page
- [x] Server procedure to fetch materials list from sebasnap.com admin API
- [x] Map sebasnap material format to SEBA AI Studio material schema
- [x] Allow editing imported material before saving

## Feature: Enforce content rules for each material type
- [x] Quiz: exactly 4 options per question, exactly 1 correct answer, no duplicate options
- [x] Crossword: words must intersect at shared letters, minimum 5 words, grid auto-sized
- [x] Missing Words: 20–30% of words blanked, blanks distributed evenly, no consecutive blanks
- [x] Wordsearch: grid size scales with word count (min 10×10), all words must fit, no overlapping conflicts

## Feature: Preview-and-edit before saving to My Materials
- [x] After material generation, show a full preview modal/page instead of saving immediately
- [x] Allow inline editing of all fields (questions, options, correct answer, words, text)
- [x] "Save to My Materials" button only appears after user reviews the preview
- [x] "Regenerate" button to discard and generate again without saving

## Feature: LOMLOE Competency Detail Pages
- [x] Create CompetencyDetail page with full descriptors for all 8 competencies
- [x] Add back button to return to previous page
- [x] Link each Home page competency card to its detail page
- [x] Add /competency/:id route to App.tsx
- [x] Add "LOMLOE Competencies" entry to NavBar
- [x] Add i18n keys for all new competency descriptor strings

## Improvement: Unique competency detail page headers
- [x] Give each of the 8 LOMLOE competency detail pages a unique hero header with its own colour gradient, large emoji, full name, and LOMLOE code badge

## Fix: Scroll to top on competency detail page navigation
- [x] Add useEffect scroll-to-top when competency code param changes in CompetencyDetail.tsx

## TA Fòrum – Real-time Social Chat
- [x] DB tables: forum_channels, forum_messages, forum_direct_messages, forum_user_presence
- [x] Server procedures: forum.getChannels, forum.getMessages, forum.sendMessage, forum.getDirectMessages, forum.sendDirectMessage, forum.setPresence, forum.getOnlineUsers
- [x] Forum page layout: sidebar (channels + DM list + online users), main chat window
- [x] Channel chat: message bubbles (own=right, others=left), avatar, timestamp, sender name
- [x] Direct message chat: 1-to-1 conversation with any online user
- [x] Polling-based real-time updates (new messages every 2s)
- [x] Online presence indicator (green dot) with last-seen fallback
- [x] Unread message badge on channel/DM list entries
- [x] Message input with send button and Enter-to-send
- [x] Auto-scroll to latest message on new message
- [x] i18n keys for TA Fòrum in EN/ES/CA
- [x] NavBar link to /forum
- [x] Vitest tests for forum procedures

## Fix: Competències page incomplete translations
- [x] Audit all keys used in Competències / CompetencyDetail pages
- [x] Add missing ES translations for all Competències keys
- [x] Add missing CA translations for all Competències keys
- [x] Verify 0 TypeScript errors and all tests pass

## Bug Fixes: Challenge button & Export buttons
- [x] Fix Class Challenge button — diagnose why it does not navigate/work
- [x] Fix PDF export button in MaterialView
- [x] Fix Word (.docx) export button in MaterialView
- [x] Fix PNG export button in MaterialView

## Bug Fixes: Challenge button + Export crash (2026-03-31)
- [x] Fix Challenge button on My Materials page (navigation broken)
- [x] Fix PDF/Word/PNG export buttons causing page crash/blank

## Bug Fix: Challenge lobby blank screen (2026-03-31)
- [x] Fix blank screen after Start Challenge creates a room code (lobby view renders blank)

## Bug Fix: Presentation page text invisible/missing (2026-03-31)
- [x] Fix invisible/missing text on Presentation page (colour contrast, theme mismatch, missing keys)

## Bug Fix: Crossword clue rows overlap (2026-04-01)
- [x] Fix overlapping words/rows in crossword clue list on MaterialView page

## Bug Fix: Crossword rendering (2026-04-01)
- [x] Fix overlapping words/rows in crossword clue list on MaterialView page
- [x] Fix missing crossword grid (grid is not rendered at all)

## Follow-up Features (2026-04-01)

### 1. Crossword Interactive Play Mode
- [x] Add per-cell text inputs to CrosswordGrid in student mode
- [x] Highlight correct cells green and incorrect cells red on "Check Answers"
- [x] Add "Check Answers" and "Clear" buttons to CrosswordViewer
- [x] Auto-advance focus to next cell on letter entry

### 2. TA Fòrum Voice Messages
- [x] Add hold-to-record microphone button in Forum chat input
- [x] Upload recorded audio blob to S3 via server
- [x] Transcribe audio with Whisper via forum.sendVoiceMessage procedure
- [x] Render voice message bubbles with audio player + transcript in chat

### 3. Presentation PDF Export (server-side)
- [x] Add server-side tRPC procedure to render slides as clean PDF
- [x] Use slide data (title, content, vocab, notes) to build PDF with reportlab-style formatting
- [x] Wire PDF download button on Presentation page to server procedure

### 4. Progress Page Competency Radar Chart
- [x] Install recharts (already available) RadarChart component
- [x] Compute per-competency average score from user's practice history
- [x] Render radar/spider chart across all 8 LOMLOE competencies on Progress page
- [x] Add legend and score labels to radar chart

### 5. Challenge QR Code & Shareable Join URL
- [x] Install qrcode.react package
- [x] Generate shareable join URL: /challenge/join?code=XXXX from lobby
- [x] Display QR code of join URL in Challenge lobby
- [x] Add "Copy Link" button next to QR code
- [x] Handle /challenge/join?code= route to auto-fill the room code

### 6. Admin Usage Analytics Dashboard
- [x] Add server procedures: analytics.activeUsers, analytics.materialsPerWeek, analytics.topCompetencies
- [x] Add analytics section to Admin page with stat cards
- [x] Add bar chart for materials created per week (last 8 weeks)
- [x] Add top-5 competencies pie/bar chart

### 7. Student Notifications
- [x] Add in-app notifications table (DB + server procedures)
- [x] Add notification bell icon with unread badge to NavBar
- [x] Bell dropdown shows all notifications, mark-read, mark-all-read
- [x] Fire notification when teacher starts a challenge
- [x] Notification polling every 30s for logged-in users

## Bug Fix: Forum DM list query error (2026-04-01)
- [x] Fix getDmList SQL query - SUBSTRING_INDEX/GROUP_CONCAT incompatible with TiDB

## Feature: Import from sebasnap.com (implementation)
- [x] Server procedure: fetch presentations from sebasnap.com API using x-api-key header
- [x] Map sebasnap presentation schema to SEBA material schema
- [x] Add "Import from SEBA Snap" button on My Materials page
- [x] Import dialog: list sebasnap presentations, allow user to select before importing
- [x] Allow editing imported material title/subject before saving to DB

## Branding: Official SEBA Logo
- [x] Upload SEBA1.png to CDN
- [x] Replace NavBar text logo with official SEBA logo image

## Feature: Clara follow-on question chips
- [x] Server: lomloe.chat returns followUpQuestions string[] (2-3 chips) alongside content
- [x] Client: Message type extended with optional followUpQuestions field
- [x] Client: AIChatBox renders chips below each assistant bubble
- [x] Client: Clicking a chip sends it as a new user message
- [x] Client: Chips hidden while a response is loading
- [x] Client: Chips translated when language is switched (via translateMessages)

## Feature: Clara self-learning & adaptive responses
- [x] DB: clara_user_profiles table (userId, questionCount, avgQuestionLength, preferredCompetencies, preferredYearGroups, topicKeywords, responseDepthPreference, communicationStyle, lastUpdated)
- [x] DB: migration applied via webdev_execute_sql
- [x] Server db.ts: getClaraProfile(userId) and upsertClaraProfile(userId, patch) helpers
- [x] Server lomloe.ts: after each chat turn, run async profile-update LLM call to extract style signals
- [x] Server lomloe.ts: load profile at chat start and inject adaptive context into Clara's system prompt
- [x] Server lomloe.ts: new tRPC procedure lomloe.getClaraProfile (protected) for optional UI display
- [x] Client: profile signals used silently (no UI required for MVP)

## Feature: PWA (Progressive Web App)
- [x] client/public/manifest.json with name, icons, theme_color, display:standalone
- [x] client/public/sw.js service worker for offline shell caching
- [x] client/index.html: link manifest, apple-touch-icon, theme-color, viewport meta
- [x] Generate 192x192 and 512x512 PNG icons from SEBA logo and upload to CDN
- [x] client/src/components/PwaInstallBanner.tsx: install prompt for Android + iOS instructions
- [x] Wire PwaInstallBanner into App.tsx

## Feature: Install App button in NavBar
- [x] Create usePwaInstall hook (shared install prompt state + iOS detection)
- [x] Add Install App button to NavBar (hidden when already installed or not installable)
- [x] Button triggers Android/Chrome native prompt; shows iOS modal on Safari

## Feature: App update available banner
- [x] Service worker posts a message to all clients when a new version is waiting
- [x] useAppUpdate hook listens for the SW message and exposes showBanner / refresh / dismiss
- [x] UpdateBanner component: sticky top banner with "Update available" text, Refresh button, dismiss X
- [x] Wire UpdateBanner into App.tsx above the Router

## Feature: Download App button on homepage
- [x] Add Download App button to Home.tsx hero section (next to "Start Chatting" and "Practice Questions")
- [x] Button uses usePwaInstall hook to trigger install prompt
- [x] Button shows Download icon and "Download App" text
- [x] Button hidden when app is already installed or browser doesn't support PWA

## Feature: Pulse animation on Download icon
- [x] Add @keyframes pulse-subtle animation to client/src/index.css
- [x] Apply animation to Download icon in Home.tsx hero button
- [x] Apply animation to Download icon in NavBar Install App button

## Feature: First-launch language picker (PWA)
- [x] FirstLaunchLanguagePicker component: full-screen overlay with EN/ES/CA flag cards
- [x] Show only on first PWA open (localStorage flag: seba_lang_chosen)
- [x] On selection, set language in I18nContext and dismiss overlay
- [x] Wire into App.tsx so it appears before any other content

## Feature: Install analytics tracking
- [x] Track Download App button click (log to console / localStorage for now)
- [x] Listen for appinstalled browser event and log install completion
- [x] Show a brief toast "SEBA installed successfully!" on appinstalled

## Feature: What's New changelog modal on update banner
- [x] WhatsNewModal component: modal listing latest improvements
- [x] "See what's new" link in UpdateBanner opens the modal
- [x] Changelog entries defined as a static array (easy to update per release)
- [x] Modal dismisses on backdrop click or close button

## Feature: Clara thumbs-up/down rating
- [x] DB: clara_message_ratings table (id, userId, messageId, rating 'up'|'down', messageContent, createdAt)
- [x] DB: migration applied
- [x] Server db.ts: rateMessage(userId, messageId, rating, messageContent) and getUserRatings(userId) helpers
- [x] Server routers: lomloe.rateMessage protected procedure
- [x] Client: ThumbsRating component shown below each assistant bubble (appears on hover, stays after rating)
- [x] Client: optimistic update — selected thumb highlighted immediately, mutation fires in background
- [x] Client: rating factored into Clara's adaptive profile system prompt (positive/negative feedback signal)

## Feature: Clara Knows You profile panel
- [x] Add lomloe.getClaraRatingSummary protected procedure (up/down counts, pct helpful)
- [x] ClaraProfilePanel component: collapsible card showing style, top competencies, keywords, rating score, reset button
- [x] Wire into Chat.tsx sidebar area (toggle button in chat header)
- [x] lomloe.resetClaraProfile protected mutation to clear the profile

## Feature: Rating summary in Admin dashboard
- [x] Add analytics.getRatingSummary procedure (weekly up/down counts for last 8 weeks)
- [x] Add rating summary section to Admin page with bar chart (up vs down per week)
- [x] Add overall helpfulness stat card (total ratings, % helpful)

## Feature: Report a Problem on thumbs-down
- [x] Extend clara_message_ratings table with reportReason column (nullable)
- [x] DB migration applied
- [x] After thumbs-down click, show small dropdown: Wrong info / Not relevant / Too long / Too short / Other
- [x] Store selected reason in DB via lomloe.rateMessage mutation (extend input schema)
- [x] Reason surfaced in Clara adaptive profile prompt for targeted improvement

## Feature: Group Progress Hub (Progress page redesign)
- [x] DB: Existing tables (classGroups, groupStudents, studentProgress, assignments, assignmentCompletions) used — no new migration needed
- [x] Server: progress.getAllGroupsSummary — lists all teacher groups with studentCount, totalActivities, overall score, LOMLOE grade, top competencies
- [x] Client: Progress page redesigned as Group Progress hub — group cards with score ring, LOMLOE grade badge, student count, activity count, top competency chips
- [x] Client: Each group card links to /groups/:groupId/progress (GroupProgress page — class heatmap, AI report)
- [x] Client: GroupProgress links to /groups/:groupId/student/:studentId (StudentProgress — radar chart, activity history, assignments, AI PDF report)
- [x] Client: LOMLOE grade scale legend at bottom of Progress hub
- [x] Client: Summary stat cards (total groups, students, activities, overall average)

## Feature: CSV grade export from Group Progress hub
- [x] Server: progress.exportGroupGradesCSV(groupId) — returns CSV string with student name, per-competency averages, overall score, LOMLOE grade
- [x] Client: Download icon button on each group card in Progress hub triggers CSV download
- [x] CSV includes header row and LOMLOE grade column

## Feature: Auto-link challenge results to group studentProgress
- [x] Already implemented via saveChallengeToGroup procedure — matches participants by nickname and writes studentProgress rows

## Feature: Progress link in NavBar Teacher dropdown
- [x] Add "Group Progress" link to the Teacher dropdown in NavBar.tsx pointing to /progress
- [x] Translate the label in all three languages (EN/ES/CA) in I18nContext

## Bug: Image issues
- [x] Fix SebaSnap: mapSebasnapToSlides now carries over imageUrl/image/img/thumbnail fields from SebaSnap slide data
- [x] Fix Create Material: SlidesPreview has AI image generation button per slide (calls materials.generateSlideImage)
- [x] Fix Create Material: SlidesPreview has file upload button per slide (uploads to S3)
- [x] Fix MaterialView: renders actual <img> when slide.imageUrl is present instead of text hint only
- [x] Server: materials.generateSlideImage(prompt) and uploadSlideImage(base64) protected mutations added

## Feature: Image follow-ups (MaterialView + Create + Presentation)
- [x] MaterialView: Regenerate Image button added to SlidesViewer (appears below image when imagePrompt exists, calls materials.generateSlideImage)
- [x] MaterialView: Generate Image button added when slide has imagePrompt but no imageUrl yet
- [x] Create page: bulk "Generate All Images (N)" button added above slide list when 2+ slides lack images
- [x] Presentation full-screen mode: already renders slideImages[idx] as actual img tag — confirmed working

## Feature: Image embedding in Word and PDF exports
- [x] Word export: buildSlidesDoc made async — fetches each slide's imageUrl as ArrayBuffer and embeds via docx ImageRun (480×270px, 16:9)
- [x] Word export: placeholder text "[Image: <prompt>]" shown when slide has imagePrompt but no imageUrl yet
- [x] PDF export: html2canvas already captures rendered DOM including <img> tags — works automatically
- [x] MaterialView SlidesViewer: added crossOrigin="anonymous" to slide <img> tag for html2canvas CORS support
- [x] Presentation.tsx: added crossOrigin="anonymous" to slide <img> tag for html2canvas CORS support

## Bug: Create Material sign-in redirect
- [x] getLoginUrl() updated to accept optional returnPath, encoded as JSON in the base64 state parameter
- [x] OAuth callback (/api/oauth/callback) now decodes returnPath from state and redirects there instead of always going to /
- [x] All sign-in buttons/links across Create, Admin, Challenge, GroupProgress, Groups, MyMaterials, Presentation, Progress, StudentProgress, DashboardLayout, and main.tsx updated to pass current path as returnPath

## Bug: Practice mode correct answer misalignment
- [x] Root cause: 68.8% of knowledge bank questions had correctIndex=1 (AI always placed correct answer in position 1 when generating questions)
- [x] Fix: added shuffleQuestion() helper in lomloe router that shuffles options array and recalculates correctIndex to match the new position of the correct answer
- [x] Applied to both getRandomQuestion (Practice mode) and getQuestions (Challenge, SampleQuestions) so all question consumers benefit

## Feature: Balanced knowledge bank answer distribution
- [x] Regenerated all 96 questions so correct answers are distributed evenly: 24 per position (0/1/2/3)
- [x] Each question's explanation updated to match the correct answer text at its new position
- [x] All correctIndex values verified valid (0-3), no out-of-range entries

## Feature: Per-question analytics in Admin dashboard
- [x] Added question_answers DB table (questionId, isCorrect, competency, yearGroup, userId, createdAt)
- [x] Added saveAnswer tRPC mutation (public) called from Practice page on each answer reveal
- [x] Added getQuestionAnalytics admin procedure returning per-question correct/incorrect counts sorted hardest first
- [x] Added Question Difficulty Analytics section to Admin dashboard showing top 20 most-missed questions
- [x] Shows question ID, competency badge, year group, total attempts, % correct with colour-coded bar (red/amber/green)

## Bug: Admin dashboard competency question counts out of sync
- [x] Investigated: server returns correct data from live knowledge bank. Admin dashboard was showing correct numbers (96 at the time). Now updated to 240 after knowledge bank expansion.

## Feature: Expand knowledge bank to 240 questions
- [x] Generated 208 new questions via LLM (26 per competency × 8 competencies)
- [x] Trimmed to exactly 10 per competency per year group = 240 total (30 per competency)
- [x] Correct answer positions balanced evenly: 60 per position (0/1/2/3)
- [x] All questions aligned to LOMLOE curriculum standards
- [x] Updated lomloe.test.ts to expect 240 questions — 55/55 tests passing

## Feature: Weekly automatic question generation
- [x] Built server/questionGenerator.ts with generateAndAppendQuestions() — calls LLM in batches per (competency, yearGroup), balances correctIndex, appends to lomloeKnowledgeBank.ts
- [x] Added lomloe.generateNewQuestions admin tRPC mutation (count: 1-100, default 30)
- [x] Scheduled weekly cron every Monday at 04:00 via Manus scheduler
- [x] Owner notified via notifyOwner() after each run with added count and per-competency breakdown
- [x] Added "Generate 30 Questions Now" button to Admin dashboard with loading/success/error states

## Feature: Question review system (approve/reject auto-generated questions)
- [x] Added generated_questions DB table (questionId, competency, yearGroup, question, options JSON, correctIndex, explanation, status: pending/approved/rejected, reviewedBy, notes, reviewedAt, createdAt)
- [x] Rewrote questionGenerator.ts to save questions to DB instead of writing to TypeScript source file (fixes production read-only filesystem issue)
- [x] Added getQuestionsForReview admin tRPC query returning all pending questions
- [x] Added reviewGeneratedQuestion admin mutation to approve/reject with optional notes
- [x] Added Question Review Queue section to Admin dashboard with expand/collapse, approve/reject buttons, and options display

## Feature: 4-PIN gate on Admin page
- [x] Added PIN gate (2024) shown after OAuth auth check, before the main dashboard content
- [x] Persisted PIN unlock in sessionStorage so re-entry is not needed on page refresh
- [x] Numeric keypad UI with PIN dots, error state, and backspace button

## Bug: "Generate 30 Questions Now" button fails on Admin page
- [x] Root cause: questionGenerator.ts was writing to TypeScript source file on disk — fails on production read-only filesystem
- [x] Fix: rewrote to save questions to generated_questions DB table instead — works in all environments

## Feature: Show approved DB questions in Question Library
- [x] Updated lomloe.getQuestions to merge approved generated_questions from DB with static knowledge bank (async, filters applied to both sources)
- [x] Updated lomloe.getStats to include DB-approved question counts in totals (totalQuestions ≥ 240)
- [x] Question Library page shows merged total automatically via filtered.length (no frontend change needed)
- [x] Filters (competency, year group) applied to both static and DB questions via Drizzle WHERE conditions
- [x] Updated tests to expect totalQuestions ≥ 240 and handle DB-merged pool correctly — 55/55 passing

## Bug: Generated questions not always in default language (English)
- [x] Updated questionGenerator.ts LLM system and user prompts to explicitly instruct English-only output
- [x] Rebuilt entire knowledge bank (480 questions) in English using the corrected prompt

## Bug: Generated questions may be duplicated
- [x] Added isTooSimilar() helper in questionGenerator.ts using word-overlap similarity (>= 80% threshold)
- [x] Duplicate check runs against all static + DB questions before saving each new question
- [x] Skipped duplicates are counted and included in the generation summary

## Feature: Auto-approve generated questions
- [x] questionGenerator.ts saves new questions with status = 'approved' by default (autoApprove: true)
- [x] autoApprove option available to opt into manual review if needed
- [x] Existing pending DB questions approved via migration script

## Feature: Expand knowledge bank to 60 questions per competency
- [x] Generated 480 total questions (60 per competency × 8, 20 per year group) all in English
- [x] Replaced all Spanish questions with English ones
- [x] correctIndex balanced evenly: 120 per position (0/1/2/3)
- [x] All generated questions auto-approved (status = 'approved') immediately
- [x] Updated tests to expect 480 questions — 55/55 passing

## Bug: Clara auto-prompt repeated microphone notification on mobile
- [x] Root cause: SpeechRecognition.start() was called every 400ms on mobile when the OS ended sessions due to silence timeouts — each call triggers the system mic notification banner
- [x] Fix: added exponential backoff (1.5s→8s on mobile, 400ms on desktop), page visibility pause/resume, and session duration tracking to reset backoff after productive sessions

## Bug: Clara auto-prompt repeated microphone notification on mobile
- [x] Root cause: SpeechRecognition.start() was called every 400ms on mobile when the OS ended sessions due to silence timeouts — each call triggers the system mic notification banner
- [x] Fix: added exponential backoff (1.5s→8s on mobile, 400ms on desktop), page visibility pause/resume, and session duration tracking to reset backoff after productive sessions

## Feature: Print layout with school/student metadata + answer sheet
- [x] Print dialog: collect school name, student name, year/class before printing
- [x] Print layout page 1: title heading, school name, student name, year/class, then material content (no answers)
- [x] Print layout page 2: answer sheet with title + "Answer Sheet" heading and year/class
- [x] Update printElement / ExportToolbar to accept metadata and render both pages

## Feature: Mic input + TTS response on mobile and desktop
- [x] Add voice.transcribe and voice.tts tRPC procedures (server/routers/voice.ts)
- [x] Register voiceRouter in appRouter
- [x] Show mic button on mobile (was previously hidden)
- [x] On mobile mic tap: record audio via MediaRecorder, upload to S3, call voice.transcribe, auto-send transcript
- [x] After each AI response: call voice.tts, play MP3 audio automatically
- [x] Add speaker/mute toggle so users can disable auto-TTS
- [x] Show recording indicator and playback state in UI

## Bug: TTS audio not playing
- [x] Fix autoplay policy: unlock audio context on first user interaction, then auto-play TTS
- [x] Fix TTS trigger: watch last assistant message content (not just messages.length) to handle streaming updates
- [x] Add per-message "Speak" button on assistant bubbles as a reliable user-gesture fallback
