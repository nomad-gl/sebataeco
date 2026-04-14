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

## Bug: TTS server endpoint 404 - replace with Web Speech API
- [x] Replace server-side TTS (voice.tts trpc call) with browser window.speechSynthesis
- [x] Remove voice.tts procedure from server/routers/voice.ts (keep uploadAudio + transcribe)
- [x] Update AIChatBox to use SpeechSynthesisUtterance for instant, no-network TTS

## Bug: Speech synthesiser does not reset after reading a response
- [x] Fix Chrome long-text pause bug: use keepAlive interval to prevent synthesis from pausing mid-utterance
- [x] Ensure isSpeaking resets to false reliably after onend fires
- [x] Add utterance ref so cancel() properly clears state on component unmount

## Feature: Speech rate control
- [x] Add speechRate state (0.75, 1.0, 1.25) persisted to localStorage
- [x] Apply rate to SpeechSynthesisUtterance in playTTS
- [x] Add rate toggle button (0.75×/1×/1.25×) next to mute button in input bar

## Bug: Chrome speech cuts out after a few seconds, UI stays stuck on "Speaking…"
- [x] Replace keepAlive pause/resume hack with sentence-chunking: split text into short sentences and speak them sequentially via onend chaining
- [x] Ensure isSpeaking resets to false only after the final chunk finishes
- [x] Ensure stopSpeaking() cancels all pending chunks immediately

## Feature: Input box above icon buttons
- [x] On mobile only: move textarea to its own row above the speaker/mic/send icon row (desktop unchanged)

## Change: Rename 'Junior' to 'Primary' on learning descriptors
- [x] Find all occurrences of 'junior'/'Junior' in learning descriptor files, shared constants, and UI
- [x] Replace with 'primary'/'Primary' preserving case

## Bug: My Classes - can only add 1 student
- [x] Diagnose why only one student can be added to a class
- [x] Fix so multiple students can be added

## Feature: My Classes - bulk import + inline edit
- [x] Bulk-import: "Paste a list" button opens dialog accepting Name, Email per line
- [x] Bulk-import: parse lines, validate, insert all students in one server call
- [x] Inline edit: edit icon on each student row opens inline name/email fields
- [x] Inline edit: save via updateStudent tRPC mutation, cancel restores original values

## Feature: My Classes - CSV export, sort, count badges
- [x] Export roster to CSV: "Download CSV" button on student table
- [x] Sortable Name column: click header to toggle A→Z / Z→A sort
- [x] Student count badge: show number of students next to each class name in the left panel

## Feature: My Classes - last-active date per student
- [x] Derive last-active date from challenge log or score entries per student
- [x] Return lastActive timestamp in listStudents server procedure
- [x] Display last-active date in the student roster table

## Feature: My Classes - student search box
- [x] Add search input above the student roster table to filter by name or email

## Bug: Log a Score Manually - cannot log multiple competencies
- [x] Diagnose why only one competency can be logged at a time
- [x] Fix so multiple competencies can be logged in a single submission

## Feature: My Classes - class summary panel
- [x] Add server procedure groups.getClassSummary returning per-student assessment grades and competency coverage
- [x] Add class summary tab/panel in Groups.tsx showing a table of students × assessments with grades
- [x] Show a competency coverage column listing all competencies each student has been assessed on

## Feature: Class Report - print preview on Download PDF
- [x] Replace plain text blob download with window.print() print preview (allows printer or Save as PDF)
- [x] Inject a styled @media print HTML page with the report content before calling window.print()
- [x] Same fix for StudentProgress Download PDF button

## Feature: Print report - school logo + competency chart
- [x] Add school logo upload (stored as base64 in localStorage) accessible from a settings panel or print dialog
- [x] Inject logo top-right of the print header in both Class Report and Student Report print pages
- [x] Render competency scores as an inline SVG bar chart in the print HTML (no external libraries)
- [x] Include chart in both Class Report and Student Report print output

## Feature: School Calendar Planner + Lesson Planner
- [x] school_calendar_events and lesson_plans tables added to schema and migrated
- [x] plannerRouter with listCalendarEvents, createCalendarEvent, updateCalendarEvent, deleteCalendarEvent, aiInfillCalendar, listLessonPlans, getLessonPlan, saveLessonPlan, deleteLessonPlan, aiGenerateLessonPlan procedures
- [x] SchoolCalendar.tsx page: monthly calendar grid, event CRUD (holiday/special/lesson), AI infill for empty weeks
- [x] LessonPlanner.tsx page: full LOMLOE fields (skills, systems, competencies, saberes basicos, learning outcomes, evaluation criteria, procedure table), AI generation, print preview with format picker
- [x] Both pages wired into teacher dropdown in NavBar.tsx and App.tsx routes

## Feature: Planner follow-ups (calendar link + term grid + i18n)
- [x] Calendar: clicking a lesson event opens Lesson Planner pre-filled with title, date, year group
- [x] Calendar: add term overview weekly grid view (horizontal strip for current term)
- [x] i18n: add nav_school_calendar and nav_lesson_planner keys to EN/ES/CA in I18nContext.tsx
- [x] i18n: translate all labels in SchoolCalendar.tsx and LessonPlanner.tsx for ES and CA

## Feature: School Calendar - header panel + LOMLOE-aligned AI infill
- [x] i18n: translate all labels in LessonPlanner.tsx for ES and CA (wire t() calls)
- [x] School Calendar: add header panel with school name, subject title, tutor name, year/level
- [x] School Calendar: AI infill generates full LOMLOE-aligned lesson details per day (competencies, saberes básicos, learning outcomes, not just titles)
- [x] School Calendar: AI-generated events store competency + learning outcome in description field so Lesson Planner deep-link pre-fills them
- [x] School Calendar: support multiple named calendars per teacher (each with own school name, subject, tutor, year/level, academic year)
- [x] School Calendar: calendar picker sidebar/dropdown to create, switch, rename, delete calendars
- [x] School Calendar: all events scoped to selected calendar (calendarId FK)
- [x] School Calendar: DB migration - add school_calendars table and calendarId FK on school_calendar_events

## Feature: Question Library – multilingual questions (EN/ES/CA)
- [x] Add question_translations DB table (questionId, locale, question, options JSON, explanation)
- [x] DB migration applied for question_translations
- [x] lomloe.getQuestions accepts optional locale param and merges translations
- [x] lomloe.translateQuestions protected procedure: batch-translates untranslated static questions via LLM and stores in question_translations
- [x] SampleQuestions.tsx passes current locale to getQuestions query
- [x] Question Library search also searches translated text when locale is ES or CA
- [x] Vitest tests updated/added for locale-aware getQuestions

## Bug: Mobile dropdown menu does not scroll
- [x] NavBar mobile menu panel: add overflow-y-auto and max-h (e.g. max-h-[80vh]) so the menu scrolls when content exceeds viewport height
- [x] Ensure the mobile menu backdrop/overlay does not block scrolling

## Feature: Admin – Translation Progress Panel
- [x] lomloe.getTranslationProgress procedure: returns total questions, translated count per locale (es, ca)
- [x] Admin page: Translation Management section with ES/CA progress bars and "Translate next 30" buttons per locale
- [x] Admin page: shows remaining count and allows repeated batch translation until complete

## Feature: Question Library – PDF Worksheet Export
- [x] lomloe.exportWorksheet tRPC procedure: accepts questionIds, locale, includeAnswers flag; returns PDF as base64
- [x] SampleQuestions.tsx: "Print Worksheet" button opens modal to select questions and export options
- [x] PDF worksheet: two versions generated — with answers (correct option highlighted) and without answers (blank lines)
- [x] PDF uses current locale for question text

## Feature: School Calendar – Topic Block Creation
- [x] DB: add calendarType (enum: 'full_year' | 'topic_block'), startDate, endDate, topicDescription columns to school_calendars
- [x] DB migration applied for new school_calendars columns
- [x] tRPC createCalendar and updateCalendar accept calendarType, startDate, endDate, topicDescription
- [x] AI infill prompt uses topicDescription to scope LOMLOE lesson generation to the specific topic/unit
- [x] AI infill uses startDate/endDate to constrain generated lesson dates within the topic block range
- [x] SchoolCalendar UI: creation modal has a type toggle (Full Year vs Topic Block)
- [x] Topic Block mode shows start date picker, end date picker, and topic description textarea
- [x] Calendar header panel displays topic description when calendarType is topic_block
- [x] Calendar view auto-navigates to startDate when a topic block calendar is selected

## Bug: Lesson Planner – mobile layout improvements
- [x] LessonPlanner: top action bar (Save, Print, AI Generate buttons) stacks properly on mobile without overflow
- [x] LessonPlanner: metadata grid (date, year group, subject, duration) switches to single-column on mobile
- [x] LessonPlanner: procedure/activities table scrolls horizontally on mobile (or collapses to card layout)
- [x] LessonPlanner: competency/saberes/outcomes/criteria tag inputs are full-width on mobile
- [x] LessonPlanner: section headers and labels have adequate font size and tap targets on mobile
- [x] LessonPlanner: print preview modal is scrollable and readable on mobile
- [x] LessonPlanner: saved plans list sidebar collapses or moves below main content on mobile

## Feature: School Logo in Print/PDF dialogs
- [x] Build reusable LogoUploader component: file input (PNG/JPG/SVG), preview thumbnail, remove button, persists to localStorage key "seba_school_logo"
- [x] LessonPlanner print dialog: show LogoUploader before paper format selector; logo preview visible in dialog
- [x] LessonPlanner buildPrintHtml: already reads localStorage logo — ensure it renders correctly top-right of printed page
- [x] SampleQuestions worksheet export modal: add LogoUploader section so logo appears on both answer-key and student PDF versions
- [x] server/worksheetPdf.ts: accept optional logoDataUrl param and render logo top-right of each PDF page header

## Feature: Settings – Branding Section
- [x] Settings page: add "Branding" tab/section with LogoUploader component
- [x] Branding section: shows current logo preview if one is stored in localStorage
- [x] Branding section: upload button accepts PNG/JPG, stores to localStorage key "seba_school_logo"
- [x] Branding section: remove/clear logo button resets localStorage and preview
- [x] Branding section: shows a "Where this logo appears" note listing Lesson Planner print and Question Library PDF export
- [x] Branding section: live preview card showing how the logo looks on a printed header

## Feature: Settings Page – Branding
- [x] Create /settings route and Settings.tsx page with Branding section
- [x] Branding section uses LogoUploader component with live print-header preview card
- [x] Add nav_settings i18n key in EN/ES/CA
- [x] Add Settings link to NavBar (desktop user area and mobile menu)
- [x] Register /settings route in App.tsx

## Bug: School Calendar – Create Calendar button hidden
- [x] Fix Create Calendar button visibility in the calendar sidebar (ensure it is not clipped or hidden behind overflow)

## Task: Full i18n – translate all hardcoded English strings
- [x] Audit all pages/components for hardcoded English strings
- [x] Add all missing keys to I18nContext.tsx (EN/ES/CA)
- [x] Wire t() into SchoolCalendar.tsx (all dialogs, toasts, empty states, placeholders, buttons)
- [x] Wire t() into Settings.tsx
- [x] Wire t() into Admin.tsx
- [x] Wire t() into NavBar.tsx remaining hardcoded strings
- [x] Wire t() into SampleQuestions.tsx remaining hardcoded strings
- [x] Wire t() into Home.tsx remaining hardcoded strings
- [x] Wire t() into Chat.tsx, Create.tsx, MaterialView.tsx, Groups.tsx remaining hardcoded strings

## Feature: Settings – School & Class quick-fill
- [x] Settings page: add "School & Class" section with fields: school name, default subject, default year/level, default tutor name
- [x] Store values in localStorage key "seba_school_profile"
- [x] SchoolCalendar create/edit modal: auto-populate schoolName, tutorName, subject, yearLevel from localStorage on open
- [x] LessonPlanner: auto-populate subject, yearGroup, teacherName from localStorage on new plan
- [x] Add i18n keys for all new Settings labels (EN/ES/CA)

## Feature: Topic Block Progress Indicator
- [x] Server: add getCalendarProgress procedure returning assignedDays and totalSchoolDays for a calendar
- [x] SchoolCalendar header: show progress bar (e.g. "8 / 15 school days planned") for topic_block calendars
- [x] Progress bar updates reactively when events are added/deleted

## Feature: Duplicate Lesson Plan
- [x] LessonPlanner: add "Duplicate" button (copy icon) on each saved plan row in the plans list
- [x] Clicking Duplicate creates a copy of the plan with title suffixed "(copy)" and opens it for editing
- [x] Add i18n keys for duplicate action (EN/ES/CA)

## Feature: Calendar PDF Export
- [x] Server: calendarPdf.ts helper using PDFKit — generates timetable with school logo, header (school name, subject, tutor, year), and lesson rows with LOMLOE details
- [x] tRPC planner.exportCalendarPdf procedure: accepts calendarId, returns base64 PDF
- [x] SchoolCalendar header: "Download PDF" button triggers export and triggers browser download
- [x] PDF includes school logo from localStorage if available
- [x] i18n keys for export labels (EN/ES/CA)

## Feature: Link Calendar to My Classes Group
- [x] DB: add linkedGroupId FK (nullable) to school_calendars table; run migration
- [x] tRPC planner.linkCalendarToGroup and unlinkCalendarFromGroup procedures
- [x] SchoolCalendar header: "Link to Class" button opens group picker dialog
- [x] Calendar header: shows linked group name with unlink button when linked
- [x] i18n keys (EN/ES/CA)

## Feature: Lesson Plan Templates
- [x] DB: add isTemplate + templateName columns to lesson_plans table; run migration
- [x] tRPC planner.listTemplates, saveAsTemplate, deleteTemplate procedures
- [x] LessonPlanner: "Save as Template" button in toolbar (saves copy of current plan as template)
- [x] LessonPlanner: "Load Template" button opens template picker dialog; loads fields into form
- [x] i18n keys (EN/ES/CA)

## Bug: Placeholder/example texts not translating
- [x] SchoolCalendar: all placeholder= and example text strings use t() keys (calendar name, school name, subject, topic description, event title, etc.)
- [x] LessonPlanner: all placeholder= strings use t() keys (lesson title, objectives, materials, etc.)
- [x] Add any missing placeholder i18n keys to I18nContext.tsx (EN/ES/CA)

## Bug: Practice Mode questions/answers always in English
- [x] Audit lomloe.getQuestions procedure — check if it returns translated text based on locale
- [x] Check questionTranslations table usage in the lomloe router
- [x] Pass current UI language (locale) from Practice page to the getRandomQuestion query
- [x] Server: getRandomQuestion now accepts locale param and returns translated question, options, explanation when locale is 'es' or 'ca'
- [x] Fall back to English if no translation exists for a question
- [x] SampleQuestions already passes locale correctly (no change needed)

## Task: Rename AI assistant from 'Clara' to 'Aina'
- [x] Find all occurrences of 'Clara' in server, client, and i18n files
- [x] Replace in server system prompts (lomloe.ts, chat procedure)
- [x] Replace in DB helper function names (getClaraProfile, upsertClaraProfile → getAinaProfile, upsertAinaProfile)
- [x] Replace in i18n keys and translation strings (I18nContext.tsx)
- [x] Replace in client UI pages (Chat.tsx, any greeting/label text)
- [x] Replace in any other files (db.ts, schema column names if any)
- [x] Rename ClaraProfilePanel.tsx → AinaProfilePanel.tsx and useClaraWakeWord.ts → useAinaWakeWord.ts

## Feature: Integrate Hugging Face Translation API (Project Aina)
- [x] Research best HF models for EN→ES and EN→CA translation (Helsinki-NLP/opus-mt-en-es + opus-mt-en-ROMANCE)
- [x] Store HF_API_KEY as a project secret
- [x] Build server/ainaTranslation.ts helper (calls HF Inference API router endpoint)
- [x] Replace LLM-based batch translation in translateQuestions with Aina HF translation helper
- [x] Test translation quality: EN→ES and EN→CA tests pass (69/69 tests green)
- [x] TypeScript: 0 errors

## Task: Make Catalan the primary operational language
- [x] I18nContext: change default fallback language from 'en' to 'ca'
- [x] I18nContext: detectBrowserLang() already prioritises 'ca' first; fallback now returns 'ca'
- [x] NavBar language switcher: reordered to CA | ES | EN
- [x] FirstLaunchLanguagePicker: reordered to CA | ES | EN
- [x] Update <html lang=""> default to 'ca' in client/index.html

## Feature: Catalan dialect adaptation by IP region
- [x] Server: tRPC geoDialect.detect publicProcedure — calls ip-api.com with client IP, returns { country, region, dialect, dialectLabel }
- [x] Dialect mapping: Central (ES-CT, AD), Valencian (ES-VC), Balearic (ES-IB), Northern/Roussillonnais (FR-OCC), Alguerese (IT-SS), Standard fallback
- [x] I18nContext: CatalanDialect type added; dialect state stored in localStorage 'seba_ca_dialect'; setDialect exposed via context
- [x] dialectOverrides.ts: per-dialect CA string patches for greetings, nav labels, home hero, practice labels, chat greetings
- [x] CatalanDialectDetector component: on first CA load shows confirmation dialog; on region change shows reset dialog
- [x] Dialect choice and last-known region persisted in localStorage; region-change popup only shown when dialect actually differs
- [x] Wire dialect into Aina system prompt: caDialect param added to chat procedure; LLM instructed to use dialect vocabulary
- [x] Wire dialect into Chat.tsx: caDialect passed from useI18n() to chatMutation
- [x] DialectBadge component in NavBar: shows e.g. 'Val', 'Bal' next to CA label when a non-central dialect is active
- [x] TypeScript: 0 errors; 69/69 tests pass

## Feature: AI Governance — Grade Override Audit Trail
- [x] DB: ai_assessments + ai_grade_overrides tables created and migrated
- [x] tRPC: accountability.grades.listAssessments, createAssessment, overrideGrade, listOverrides
- [x] UI: Grade Override panel with Override button, override dialog (mandatory reason), audit log dialog
- [x] i18n keys (EN/ES/CA)

## Feature: AI Governance — Bias Guard
- [x] DB: ai_bias_flags table created and migrated
- [x] Server: biasGuard.ts middleware with LLM-based bias detection + pattern matching; logs incidents to DB
- [x] Wire biasGuard into lomloe.chat procedure
- [x] tRPC: accountability.bias.listFlags, resolveFlag
- [x] UI: Bias Incidents panel with severity badges, expand/collapse input+output, resolve button
- [x] i18n keys (EN/ES/CA)

## Feature: AI Governance — Learning Path Justification
- [x] DB: ai_learning_paths table created and migrated
- [x] tRPC: accountability.paths.generate (LLM produces structured path + justification + LOMLOE refs + evidence summary)
- [x] tRPC: accountability.paths.list, getJustification
- [x] UI: Learning Paths panel with generate dialog, step preview, full justification dialog (printable)
- [x] i18n keys (EN/ES/CA)

## Feature: AI Accountability Dashboard Page
- [x] New route /accountability — protected, teacher/admin only
- [x] Three tabs: Grade Overrides | Bias Incidents | Learning Paths
- [x] Nav link added to NavBar Teacher dropdown (ShieldAlert icon)
- [x] i18n keys for page title and tab labels (EN/ES/CA)

## Feature: Prevent Digital Shadow — Privacy by Design
- [x] Audit all DB tables for unnecessary PII or over-collection
- [x] Server: data retention policy — auto-purge practice sessions (cap 200/user), bias flags (30d), notifications (30d), forum messages (90d)
- [x] Server: tRPC privacy.getMyDataSummary — returns counts of all stored records per category
- [x] Server: tRPC privacy.deleteMyData — cascading delete of all user data (requires typed confirmation)
- [x] Server: tRPC privacy.exportMyData — returns a JSON export of all user data (GDPR data portability)
- [x] Server: PII guard — bias log inputText/outputText truncated to 200 chars on write
- [x] Server: cap practice session history to 200 most recent per user (rolling window)
- [x] UI: Privacy Dashboard page (/privacy) — data summary cards, retention policy, export and delete-all buttons
- [x] UI: Privacy nav link added to NavBar Teacher menu (Lock icon)
- [x] i18n keys for all privacy UI (EN/ES/CA)
- [x] TypeScript: 0 errors; 69/69 tests pass

## Follow-up: First-visit data notice banner
- [x] Dismissible banner on home page explaining what data SEBA collects
- [x] Links to Privacy Dashboard
- [x] Stored in localStorage so it only shows once
- [x] i18n keys (EN/ES/CA)

## Follow-up: Nightly retention cron
- [x] Schedule nightly cron at 03:00 to call privacy.runRetentionPurge
- [x] Log purge results to server console

## Follow-up: Parent privacy PDF report
- [x] tRPC privacy.generateParentReport — produces a structured summary of a student's stored data
- [x] PDF export using PDFKit
- [x] Teacher can generate and download from Privacy Dashboard

## Compliance: Catalan IEC Standard detection
- [x] On first CA load, detect Standard Catalan (IEC) as the base dialect
- [x] Show a dialect confirmation dialog: "We detected Standard Catalan. Is this correct? Or select your regional variant."
- [x] Options: Standard Catalan (IEC), Valencian, Balearic, Northern, Algherese
- [x] Store confirmed dialect in localStorage
- [x] Update CatalanDialectDetector component to use this flow

## Compliance: BSC Salamandra attribution
- [x] Add "Powered by BSC Salamandra" attribution in Footer
- [x] Add AI model credits section in About/Settings page
- [x] Add attribution tooltip on Aina chat header
- [x] i18n keys (EN/ES/CA)

## Compliance: EEA data hosting notice
- [x] Add data residency statement to Privacy Dashboard: "All data is processed within the EEA"
- [x] Add hosting provider and region info to Privacy page
- [x] Add data residency badge to footer
- [x] i18n keys (EN/ES/CA)

## Compliance: HITL formal documentation
- [x] Identify all HITL touchpoints in SEBA (grade override, bias flag resolution, learning path review, dialect confirmation)
- [x] Generate HITL Policy document (docs/HITL_Policy.md)
- [x] Add HITL policy link to Accountability page and Admin panel
- [x] i18n keys for HITL section labels (EN/ES/CA)

## Compliance: EU AI Act Technical Documentation (Article 11)
- [x] Generate full technical file: system description, intended purpose, risk classification, training data, performance metrics, human oversight measures, post-market monitoring plan
- [x] Stored as docs/EU_AI_Act_Technical_Documentation.md
- [x] Add EU AI Act compliance badge to About/Settings page
- [x] i18n keys (EN/ES/CA)

## Compliance: Improved bias mitigation
- [x] Extend biasGuard to scan materials.create, presentation, and lesson plan AI outputs
- [x] Add demographic parity check: flag if AI responses differ significantly by student gender/background
- [x] Add bias mitigation report tab to Accountability page
- [x] Add bias trend chart (flags per week) to Accountability bias tab
- [x] i18n keys (EN/ES/CA)

## Compliance: Audit Dashboard with algorithm description
- [x] New /audit route: full audit log of all AI decisions (chat, assessments, learning paths, bias flags, grade overrides)
- [x] Plain-language algorithm description panel: explains in non-technical terms how SEBA's AI makes decisions
- [x] Add audit log link to Admin panel sidebar
- [x] i18n keys (EN/ES/CA)

## Compliance: Formal Data Processing Agreement (DPA)
- [x] Generate DPA document covering: data controller/processor roles, categories of data, processing purposes, retention periods, sub-processors, data subject rights, security measures, international transfers
- [x] Stored as docs/DATA_PROCESSING_AGREEMENT.md
- [x] i18n keys for DPA section labels (EN/ES/CA)

## Follow-up: Audit Dashboard CSV Export
- [x] Add "Download CSV" button to Audit Dashboard header
- [x] tRPC audit.exportCsv procedure: returns all events as CSV text (admin-only)
- [x] Browser triggers file download with timestamped filename
- [x] i18n keys (EN/ES/CA)

## Follow-up: DPA Acceptance Flow
- [x] DB: dpa_acceptances table (userId, version, acceptedAt, ipAddress)
- [x] tRPC dpa.getStatus — returns whether current user has accepted the current DPA version
- [x] tRPC dpa.accept — records acceptance with timestamp
- [x] UI: DPA acceptance dialog shown on first login (after OAuth callback) if not yet accepted
- [x] Dialog shows DPA summary with link to full document; requires explicit checkbox + Accept button
- [x] Acceptance stored in DB; dialog not shown again after acceptance
- [x] i18n keys (EN/ES/CA)

## Follow-up: Data Protection Contact Card on Privacy Dashboard
- [x] Add "Data Protection Contacts" card to Privacy Dashboard
- [x] Card links to APDCAT (https://apdcat.gencat.cat), AEPD (https://www.aepd.es), EDPB (https://edpb.europa.eu)
- [x] Card includes platform DPA version and acceptance date for the logged-in user
- [x] i18n keys (EN/ES/CA)

## Feature: Nightly Audit Log Retention Purge
- [x] tRPC audit.runRetentionPurge (adminProcedure): deletes admin_audit_logs rows older than 24 months, returns deleted count
- [x] Server-side nightly cron at 03:30 UTC using node-cron: calls purge logic and logs result to console
- [x] Persist last purge run metadata (timestamp + deleted count) in a server-side in-memory store and expose via audit.getRetentionStatus
- [x] Audit Dashboard: show "Last purge" timestamp and deleted count in a small status badge
- [x] i18n keys for purge status labels (EN/ES/CA)

## Feature: /dpa Public Page
- [x] Create client/src/pages/Dpa.tsx — renders full DPA content as a readable page (no login required)
- [x] Register /dpa route in App.tsx
- [x] Update DpaAcceptanceDialog "View full DPA" link to point to /dpa
- [x] Update Footer to include a "Data Processing Agreement" link pointing to /dpa
- [x] i18n keys for DPA page title and section headings (EN/ES/CA)

## Fix: DPA dialog "View full DPA" link
- [x] Change link to open /dpa in a new browser tab (target="_blank") so the blocking dialog stays open while the user reads the agreement

## Feature: BSC Salamandra + Àguila Public Attribution
- [x] Update Footer: show both Salamandra and Àguila with BSC links
- [x] Update Aina chat header: attribution tooltip/badge for Salamandra + Àguila
- [x] Update Settings/About page: AI model credits section listing Salamandra and Àguila
- [x] Create /ai-models page: dedicated public page with full model descriptions, BSC links, and licence info
- [x] Register /ai-models route in App.tsx and link from Footer and About page
- [x] Add i18n keys for all new attribution strings (EN/ES/CA)

## Feature: Data Hosting Confirmation (Catalan Public Cloud / EEA)
- [x] Research Catalan Public Cloud (Núvol Públic de Catalunya) and confirm EEA hosting facts
- [x] Update Privacy page hosting section with accurate Catalan Public Cloud / EEA statement
- [x] Update Privacy Dashboard data residency card with hosting provider details
- [x] Update i18n keys for hosting statements (EN/ES/CA)
- [x] Update DPA document (docs/DATA_PROCESSING_AGREEMENT.md) Section 7.1 with Nuvulus + AI 2030 Strategy details
- [x] Update /dpa page Section 7 with infrastructure breakdown table
- [x] Add hosting confirmation badge/notice to AI Models page

## Feature: Public Audit Log
- [x] Change audit tRPC procedures (getEvents, getStats, getRetentionStatus) from protectedProcedure/adminProcedure to publicProcedure
- [x] Keep runRetentionPurge and exportCsv as admin-only (sensitive operations)
- [x] Remove auth check / redirect from AuditDashboard.tsx so unauthenticated users can view it
- [x] Add "Audit Log" link to Footer and public navigation
- [x] i18n keys for any new nav labels (EN/ES/CA)

## Fix: Practice Questions Language + Catalan Default
- [x] Audit practice question generation — found root cause: question_translations table was empty
- [x] Added on-demand inline translation fallback to getRandomQuestion: translates via Aina and caches in DB
- [x] Added background startup job to pre-populate all 480 CA translations on server boot
- [x] Changed default locale in getRandomQuestion and getQuestions tRPC procedures from "en" to "ca"
- [x] Confirmed Catalan is already the default in I18nContext (detectBrowserLang returns "ca" as fallback)
- [x] Fixed 3 lomloe tests that timed out due to inline translation — now pass locale "en" explicitly

## Fix: Rename app title to AINA | TA
- [x] Update HTML <title> in client/index.html to "AINA | TA"
- [x] Update apple-mobile-web-app-title and OG title meta tags
- [x] Update PWA manifest name and short_name to AINA / AINA | TA
- [x] Update NavBar iOS install prompt text
- [x] Replace all "SEBA AI Studio" strings in pages, server files, i18n, and compliance docs

## Fix: Complete AINA rebrand (banner + privacy notice + app title)
- [x] Update version banner: "A new version of AINA is available" (UpdateBanner.tsx + WhatsNewModal.tsx)
- [x] Update privacy notice banner: "AINA stores only what is needed…" (i18n EN/ES/CA)
- [x] Update all remaining SEBA → AINA in i18n context (audit algo descriptions, privacy subtitle, hosting desc, AI models desc)
- [x] Update PwaInstallBanner, FirstLaunchLanguagePicker, CatalanDialectDetector, Challenge gaming mode, CompetencyDetail, Footer, usePwaInstall
- [x] Update dialectOverrides.ts Valencian/Balearic/Northern/Algherese dialect descriptions
- [x] SEBA Snap references intentionally preserved (separate product)

## Fix: Aina page + footer untranslated English text
- [x] Audit AinaProfilePanel for hardcoded English strings (found 12+ strings)
- [x] Audit Footer component for hardcoded English strings (found 2 strings)
- [x] Rewrote AinaProfilePanel to use t() for all user-visible text (style/depth labels, profile states, reset button, toast messages, confirm dialog)
- [x] Fixed Footer: footer_ai_powered_by key replaces hardcoded "AI powered by"; "SEBA" → "AINA"
- [x] Added all new keys to EN, ES, and CA language blocks in I18nContext

## Fix: Practice Questions page — translate all hardcoded English text
- [x] Audit Practice.tsx for all hardcoded English strings — all strings already use t() calls
- [x] Add new i18n keys to EN, ES, and CA blocks — all 16 practice_ keys present in all 3 locales
- [x] Replace all hardcoded strings in Practice.tsx with t() calls — already complete

## Bug: Speech prompt not working on laptop/desktop
- [x] Diagnose why speech/microphone prompt fails on desktop browsers (Chrome, Firefox, Safari on macOS/Windows)
- [x] Check if the issue is getUserMedia permissions, Web Speech API vs MediaRecorder API, or HTTPS requirement
- [x] Fix the desktop speech input flow — unified to MediaRecorder→Whisper path for all devices (removed unused recognitionRef and currentAudioRef)
- [x] Test on both desktop and mobile to confirm fix does not break mobile

## Bug: Progress page does not translate
- [x] Audit Progress.tsx, GroupProgress.tsx, StudentProgress.tsx for hardcoded English strings
- [x] Move all hardcoded strings to i18n keys (21 new keys: gp_table_student/avg, gp_activities_label, gp_logo_*, gp_print_*, gp_radar_score)
- [x] Add CA and ES translations for all new keys in I18nContext.tsx

## Feature: Editable AI Student Progress Reports
- [x] DB: add student_reports table (groupId, studentId, aiText, editedText, grade, overall, lastEditedBy, timestamps)
- [x] Server: progress.saveStudentReport mutation — upsert editedText for a student
- [x] Server: progress.getStudentReport query — fetch saved report for a student
- [x] Server: progress.resetStudentReport mutation — clears editedText to restore AI version
- [x] Server: generateStudentReport now auto-persists AI report to student_reports table
- [x] Client: StudentProgress report tab — view/edit toggle with Streamdown view and textarea editor
- [x] Client: "Edit Report" toggle button switches between view mode and edit mode
- [x] Client: Edit mode shows a monospace textarea pre-filled with AI/saved text, resizable
- [x] Client: "Save Changes" button persists edited text to DB via tRPC mutation
- [x] Client: "Reset to AI Version" button restores the original AI-generated text
- [x] Client: Print/PDF export uses the active reportText (edited or AI) automatically
- [x] Client: Amber "Edited" badge shown when report has been manually edited
- [x] Client: Saved report auto-loaded from DB on page mount (persists across sessions)
- [x] i18n keys for all new UI strings (EN/ES/CA): sp_edit_report, sp_view_report, sp_save_edits, sp_saving, sp_reset_to_ai, sp_edited_badge, sp_edit_placeholder, sp_save_success, sp_save_failed, sp_reset_success, sp_reset_failed, sp_report_loaded

## Feature: Generate All Student Reports (Group Progress page)
- [x] Server: progress.generateAllStudentReports mutation — loops over all students in a group, generates + persists each report sequentially
- [x] Client: GroupProgress.tsx — "Generate All Reports" button in the Students tab
- [x] Client: Show per-student status list (done/failed) with teal progress bar
- [x] Client: Button disabled while generation is running; shows spinner + "Generating reports..."
- [x] Client: On completion, show summary toast (e.g. "8 reports generated")
- [x] Client: "View Report" link per student navigates to their StudentProgress report tab
- [x] Client: "Regenerate All" button shown after first run
- [x] i18n keys for all new UI strings in EN/ES/CA (11 new gp_all_reports_* keys)

## Bug: AINA not responding to user messages
- [x] Check server logs for errors in the chat/LLM tRPC procedure — backend is healthy, responds in ~10-14s
- [x] Root cause identified: production site was running old code with duplicate useState import in StudentProgress.tsx causing module graph errors
- [x] Fix: republished the site to deploy the latest checkpoint (2bb8a800) which has the duplicate import removed
- [x] Verified: sebata.forum chat endpoint responds correctly in Catalan, English, and Spanish

## Bug: Site keeps redirecting to sign-in page
- [x] Root cause: dpa.getStatus (protectedProcedure) called on every page — 401 for unauthenticated users triggered global redirect handler in main.tsx
- [x] Fix 1: Added SILENT_UNAUTH_PATHS set in main.tsx — dpa.getStatus, notifications.getUnreadCount, lomloe.getAinaProfile no longer trigger redirect
- [x] Fix 2: Added enabled: !!user guard to dpa.getStatus query in DpaAcceptanceDialog.tsx so it never fires for logged-out users

## Bug: AINA shows error message instead of response
- [x] Root cause: long/complex questions take 30-60s, exceeding default browser fetch timeout → catch block shows error message
- [x] Fix: Added per-endpoint timeout in main.tsx tRPC fetch — 90s for lomloe.chat, progress.generateStudent*, lomloe.translateMessages; 30s for everything else
- [x] Verified: production endpoint responds correctly in ~8-30s depending on complexity

## Feature: AI-Generated Assignments from Student Page Form
- [x] Read current NewAssignmentCard form inputs (type, topic, competency, year group, difficulty, notes)
- [x] Server: progress.generateAssignment mutation — uses LLM to create type-appropriate assignment content
- [x] Server: persist generated assignment to assignments table with aiContent field
- [x] Client: wire "Create Assignment" button to call the mutation with form inputs
- [x] Client: show generated assignment in an expandable preview panel below the form
- [x] Client: loading state with spinner and "Generating assignment..." message
- [x] i18n keys for all new UI strings (EN/ES/CA)

## Feature: AI Assignment Generation, Editing & Assessment (extended)
- [x] DB: add aiContent, assignmentType, editedContent, studentResponse, aiFeedback, aiScore, aiAssessedAt to assignments table
- [x] Server: progress.generateAssignment — LLM generates full type-appropriate assignment content
- [x] Server: progress.saveAssignmentEdit — teacher saves edited assignment content
- [x] Server: progress.assessAssignment — LLM assesses student response, returns score + detailed feedback
- [x] Client: add assignmentType selector to the New Assignment form (worksheet, essay, quiz, project, etc.)
- [x] Client: "Generate with AI" button calls generateAssignment, shows loading state
- [x] Client: generated assignment shown in expandable preview below the form (Streamdown rendered)
- [x] Client: "Edit" toggle switches to textarea for teacher to modify content; "Save" persists edits
- [x] Client: "Edited" badge shown when teacher has modified the AI content
- [x] Client: assignment list shows a "View / Assess" expand button per assignment with AI badge
- [x] Client: expanded assignment shows the content + a student response textarea + "Assess with AI" button
- [x] Client: AI assessment result shows score (0-100), grade badge, and detailed feedback (Streamdown)
- [x] i18n keys for all new UI strings in EN/ES/CA (50+ new sp_ keys)

## Feature: Student Assignment Upload & AI Grading
- [x] DB: add submissionUrl, submissionKey, submissionMime, submissionName, submissionUploadedAt columns to assignments table
- [x] Server: progress.uploadAssignmentFile mutation — accepts base64 file, uploads to S3, saves URL + key to DB
- [x] Server: progress.assessUploadedAssignment mutation — fetches file from S3 URL, sends to vision LLM (image_url), returns score + feedback
- [x] Client: AssignmentRow — drag-and-drop + click file upload zone supporting jpg/png/gif/webp/pdf/docx/doc/txt
- [x] Client: 16MB file size limit enforced client-side with translated error message
- [x] Client: After upload, show image thumbnail (for photos) or file name (for PDF/doc) with change/remove buttons
- [x] Client: "Assess with AI" (purple) triggers assessUploadedAssignment with vision LLM
- [x] Client: Text response fallback (indigo) still available for typed responses
- [x] Client: AI grade result shows score (0-100), LOMLOE grade badge, and detailed feedback (Streamdown)
- [x] Client: Re-upload supported via "Change file" button
- [x] i18n keys for all new UI strings in EN/ES/CA (14 new sp_upload_* / sp_assess_uploaded keys)

## Bug: AINA works on dev preview but not on published site (sebata.forum)
- [x] Test production chat endpoint directly — server responds correctly with the right format
- [x] Root cause: production site was running an old JS bundle (index-DKyBED7d.js) from before the AbortSignal timeout fix was applied; bundle did not contain SILENT_UNAUTH_PATHS or 90s timeout code
- [x] Fix: saved new checkpoint and republished to deploy the latest bundle with all fixes

## Feature: AINA "Thinking" Animated Indicator
- [x] AIChatBox: show animated "AINA is thinking..." message after 5 seconds of waiting
- [x] Indicator disappears when the real response arrives
- [x] i18n key for the thinking message in EN/ES/CA

## Feature: PDF Text Extraction for Assignment Submissions
- [x] Install pdf-parse npm package on the server
- [x] progress.assessUploadedAssignment: detect PDF mime type and extract text via pdf-parse before sending to LLM
- [x] Fall back to vision LLM for image files; use text extraction for PDF/docx

## Feature: Session Keep-Alive Ping
- [x] Add a lightweight background ping (trpc.auth.me.useQuery with refetchInterval: 15 minutes) to prevent JWT session expiry during idle periods
- [x] Only active when user is logged in

## Bug: AINA chat returns HTML instead of JSON for logged-out users
- [x] Diagnose: lomloe.chat mutation called by unauthenticated user returns HTML (login redirect) not JSON
- [x] Fix: intercept non-JSON/HTML responses in tRPC fetch wrapper and convert to synthetic tRPC error; add SILENT_MUTATION_PATHS to suppress noisy global logs for lomloe.chat and lomloe.translateMessages
- [x] Verify no regression for authenticated users (69/69 tests pass, TS 0 errors)

## Bug: AINA chat returns error on production for logged-in users
- [x] Diagnose: tRPC client sends null for optional fields (userId, competency, yearGroup, caDialect) but server schema used z.optional() which rejects null — causes BAD_REQUEST 400
- [x] Fix: changed all optional fields in lomloe.chat input schema to z.nullish() to accept both null and undefined
- [x] Verify: curl with null values returns HTTP 200, 69/69 tests pass

## Follow-up: Audit z.optional() vs z.nullish() across all procedures
- [x] Bulk-replaced all z.optional() with z.nullish() across all server/routers/*.ts
- [x] Fixed 16 TypeScript errors from null-to-undefined coalescing at point of use (accountability, groups, lomloe, materials, planner, presentations, voice)

## Follow-up: Vitest test for null optional fields in lomloe.chat
- [x] Added server/lomloe.chat.nullish.test.ts with 3 test cases (all-null, all-undefined, mixed); 72/72 tests pass

## Follow-up: Retry button in chat error bubble
- [x] Added onRetry/retryLabel props to AIChatBox; retry button renders below last error message
- [x] handleRetry in Chat.tsx removes error bubble and re-sends last user message
- [x] chat_retry i18n key added in EN/ES/CA

## Improvement: Human-sounding TTS via OpenAI Neural Voice
- [x] Upgrade server voice.tts from tts-1 to tts-1-hd model
- [x] Improve pickVoice() to select best voice per language (nova for EN, shimmer for ES/CA)
- [x] Wire voice.tts mutation into AIChatBox to replace browser SpeechSynthesis
- [x] Fall back to browser SpeechSynthesis if the server TTS call fails
- [x] Keep speech rate control working with the new audio player (HTMLAudioElement.playbackRate)

## Feature: TTS Voice Selector
- [x] Extend voice.tts server procedure to accept optional voice parameter (nova, shimmer, alloy, fable)
- [x] Add ttsVoice state to AIChatBox persisted to localStorage (seba_tts_voice)
- [x] Add voice picker dropdown in chat toolbar (4 voice options with descriptions, 3-letter abbreviation button)
- [x] Pass selected voice to the ttsMutation call
- [x] i18n keys for voice names and selector label in EN/ES/CA

## Feature: Pre-cache TTS for Suggested Prompts
- [x] On chat page load (2s delay), pre-fetch TTS audio for all 6 suggested prompts in the background
- [x] Store pre-cached audio blob URLs in a Map keyed by prompt text
- [x] When a suggested prompt chip is tapped, play from cache instantly (no server round-trip)
- [x] Cache is invalidated when ttsVoice or suggestedPrompts changes

## Feature: Voice Preview Button in TTS Picker
- [x] Added Play/Stop/Loader2 icons to each voice row in the picker dropdown
- [x] Clicking Play fetches a short sample via ttsPreviewMutation without changing selected voice
- [x] Shows Loader2 spinner while loading, Square stop icon while playing
- [x] tts_voice_preview_sample i18n key added in EN/ES/CA

## Feature: Auto-switch Default Voice by UI Language
- [x] useEffect on lang change auto-updates ttsVoice (shimmer for ES/CA, nova for EN)
- [x] Only auto-switches if seba_tts_voice_manual flag is NOT set in localStorage
- [x] Manual selection in picker sets seba_tts_voice_manual=1 to lock the choice
- [x] defaultVoiceForLang() helper also used on initial mount to set correct default

## Feature: Voice Name in TTS Toggle Tooltip
- [x] TTS toggle button title now shows active voice name e.g. "Voice responses: ON (Nova) — click to mute"
- [x] Uses template literal with capitalised voice name (no new i18n keys needed)

## Feature: Persist TTS Voice Preference to User Profile
- [x] Added ttsVoice ENUM column to users table in drizzle/schema.ts
- [x] Applied migration SQL directly (ALTER TABLE users ADD COLUMN ttsVoice)
- [x] Added auth.setTtsVoice protectedProcedure mutation in server/routers.ts
- [x] On login: useEffect loads ttsVoice from user object (via auth.me) and applies to state + localStorage
- [x] On voice change in picker: setTtsVoiceMutation.mutate() saves to DB if user is logged in
- [x] Manual override flag set in localStorage when DB preference loaded

## Bug: TTS 404 - server TTS endpoint unavailable
- [x] Investigated HuggingFace Inference API (deprecated), Manus Forge API (no TTS), OpenAI proxy (no TTS)
- [x] Fixed by replacing all server-side TTS mutations (ttsMutation, ttsPrefetchMutation, ttsPreviewMutation) with browser Web Speech API as the primary TTS engine in AIChatBox
- [x] voice.tts added to SILENT_MUTATION_PATHS in main.tsx to suppress any residual error logs
- [x] TypeScript: 0 errors

## Feature: No-voice notice in TTS picker
- [x] Added browserVoicesAvailable state with voiceschanged listener (handles async Chrome voice loading)
- [x] Amber ⚠ notice shown at top of voice picker when no voices are available
- [x] tts_no_voice_notice i18n key added in EN/ES/CA
- [x] TypeScript: 0 errors

## Bug: AINA chat works in preview but not on published site
- [x] Diagnose why lomloe.chat fails on sebataeco.com but works in dev preview
- [x] Added debug error info to chat error bubble (error name + message shown inline) to identify exact failure on production
- [x] Fix root cause once error type is confirmed by user (renamed clara_* tables to aina_* in production DB)
- [x] Verify on production (curl test returns HTTP 200 with full AINA reply)

## Follow-up: Voice Picker Improvements
- [x] Add "Reset to default" link in voice picker (clears seba_tts_voice_manual flag and reverts to language-derived default)
- [x] Show no-voice warning on TTS toggle button itself (amber dot/icon when no browser voices available)
- [x] Disable voice preview buttons when no browser voices available (grey out Play icons)

## Follow-up: Chat Reliability Improvements
- [x] Add automatic single silent retry in handleSendMessage (retry once before showing error bubble)
- [x] Add connection status indicator in chat header (online/offline dot)

## Feature: What's New Banner
- [x] Add `whats_new_dismissals` table (userId, version, dismissedAt) to drizzle schema
- [x] Add `whatsNew.isDismissed` tRPC query and `whatsNew.dismiss` mutation
- [x] Build WhatsNewBanner component (bottom-fixed, dismissible, shows feature list for current version)
- [x] Wire WhatsNewBanner into App.tsx (shown to all users, persists dismissal to DB for logged-in users, localStorage for guests)
- [x] Add i18n keys for What's New content in EN, ES, CA
- [x] Verify banner shows on first login and does not reappear after dismissal

## Bug: Missing production DB tables causing AINA chat error
- [x] Identify all tables defined in schema.ts that are missing from the production DB
- [x] Renamed clara_message_ratings -> aina_message_ratings and clara_user_profiles -> aina_user_profiles in production DB
- [x] Verify AINA chat works on production after migration (curl test returns HTTP 200 with full reply)
- [x] Fix root cause once error type is confirmed by user (root cause: missing DB migration)

## Improvement: Error Handling
- [x] Server: replaced all raw throw new Error("DB unavailable") with TRPCError({ code: "INTERNAL_SERVER_ERROR" }) in groups.ts, planner.ts, privacy.ts, progress.ts, audit.ts
- [x] Server: replaced all throw new Error("Group not found") with TRPCError({ code: "NOT_FOUND" }) in groups.ts
- [x] Server: added global tRPC errorFormatter in server/_core/trpc.ts — strips stack traces in production, sanitises INTERNAL_SERVER_ERROR messages
- [x] Client: upgraded global query/mutation error subscribers in main.tsx to fire sonner toast for INTERNAL_SERVER_ERROR and network failures
- [x] Client: improved ErrorBoundary — hides stack traces in production, shows error ref ID, adds Home button alongside Reload
- [x] Client: added componentDidCatch logging to ErrorBoundary so full stack is always in console even in production

## Bug: Auto voice prompt (TTS auto-play) not responding on laptop/desktop
- [x] Diagnose why TTS auto-play does not trigger on desktop browsers (two causes: browser autoplay policy blocks speechSynthesis outside user gesture; Chrome voices race condition)
- [x] Fix 1: unlockSpeechSynthesis() called synchronously inside handleSubmit, quick-prompt buttons, follow-up question buttons, and wake-word handler to satisfy browser user-gesture requirement
- [x] Fix 2: playBrowserTTS now defers speaking until voiceschanged fires if voices array is empty (Chrome async loading), with 3s timeout fallback
- [x] TypeScript: 0 errors, 72/72 tests pass

## Feature: Automated Error Detection and Self-Healing System
- [x] DB table: `error_logs` (id, source, errorCode, errorMessage, context, resolvedAt, fixApplied, requiresEscalation, createdAt) — created in production DB
- [x] DB table: `fix_history` (id, errorLogId, fixType, fixDescription, appliedAt, success) — created in production DB
- [x] Server: `server/db/errorLogger.ts` helper — logError, markResolved, recordFix
- [x] Server: `server/selfHeal.ts` — runHealthCheck (verifies DB + table schema), runSelfHeal (CREATE TABLE IF NOT EXISTS for missing tables), startHealthMonitor (5-min interval on startup)
- [x] Server: `server/routers/selfHeal.ts` tRPC router — reportClientError (public), healthCheck (admin), triggerSelfHeal (admin), getErrorLogs (admin), getFixHistory (admin)
- [x] Server: startHealthMonitor wired into server/_core/index.ts on startup
- [x] Server: selfHealRouter registered in appRouter
- [x] Server: owner notifications sent for auto-fixes and escalation-required errors via notifyOwner()
- [x] Client: ErrorBoundary reports REACT_CRASH to selfHeal.reportClientError on componentDidCatch
- [x] Client: global query/mutation error handlers report CLIENT_QUERY_ERROR / CLIENT_MUTATION_ERROR for INTERNAL_SERVER_ERROR
- [x] Admin UI: /admin/errors page — error log table, fix history, manual health check trigger, escalation badge
- [x] Admin UI: /admin/errors route registered in App.tsx

## Bug: AI cannot infill the school calendar
- [x] Diagnose exact failure mode (LLM timeout, Zod validation, date parsing, or production schema drift)
- [x] Fix the root cause and verify AI infill generates lessons successfully
- [x] Add better error feedback in the AI infill dialog (show specific error, not just generic toast)

## Feature: AI infill auto-creates linked lesson planners + daily calendar editing
- [x] Add lessonPlanId FK column to school_calendar_events table
- [x] Auto-create lesson plans when AI infills calendar (link event → lesson plan)
- [x] Add tRPC procedure to get/update lesson plan linked to a calendar event
- [x] Daily calendar editing: click a day cell to open a side panel with event list
- [x] Side panel: add new event for that day, edit existing events, delete events
- [x] Inline lesson planner editor: open linked lesson plan from calendar event with full edit form
- [x] "View Lesson Plan" button on AI-generated events in the day panel

## Feature: PARAULA – Catalan Wordle game
- [x] Research NYT Wordle rules and exact two-pass scoring algorithm
- [x] Create curated Catalan 5-letter word list (~300 answer words)
- [x] Create Spanish and English word lists (~300 each)
- [x] Implement exact Wordle scoring algorithm (two-pass: green first, then yellow)
- [x] Daily word seeded by date (same word for all players each day)
- [x] 6x5 game board with tile flip animations on reveal
- [x] Shake animation on invalid/short words
- [x] Catalan keyboard with Ç key; Spanish keyboard with Ñ; English standard
- [x] Keyboard letter state tracking (green > yellow > grey)
- [x] Help modal with examples (PILOT/DOTZE/MAGIC)
- [x] Statistics modal with win %, streak, guess distribution bar chart
- [x] Settings modal: dark/light theme toggle, game language switcher (CA/ES/EN)
- [x] Share result as emoji grid (🟩🟨⬛) copied to clipboard
- [x] Day state persistence (localStorage) – resume same day's game on reload
- [x] Stats persistence (localStorage) per language
- [x] Full i18n: Catalan, Spanish, English UI strings
- [x] Route at /paraula, linked from Teacher dropdown in NavBar

## Feature: PARAULA haptic feedback
- [x] Add navigator.vibrate(50) on each letter key press
- [x] Add navigator.vibrate(80) on ENTER/submit
- [x] Add navigator.vibrate([50,30,50]) pattern on invalid word (error shake)
- [x] Add navigator.vibrate([100,50,100,50,200]) pattern on win

## Feature: Move PARAULA into Create Teaching Materials page
- [x] Add 'paraula' activity type to Create page activity selector with Gamepad2 icon
- [x] Add LLM prompt in materials router to generate 5-letter Catalan/Spanish/English words from a topic
- [x] Add MaterialView renderer for paraula type (embeds the full playable Paraula game with topic words)
- [x] Remove standalone Paraula nav item from NavBar (game accessible via Create page)
- [x] Keep /paraula route accessible but redirect or repurpose it

## Bug: Challenge room not loading
- [x] Diagnose why the challenge room page fails to load
- [x] Fix the root cause and verify the room loads correctly

## Bug: Start Challenge button does not load room page
- [x] Fix: clicking Start Challenge on the create form does not navigate to the room/lobby view

## Bug: "Save to My Materials" page not formatted for mobile
- [x] Fix mobile layout of My Materials page: responsive grid, card sizing, button spacing, overflow

## Feature: My Materials UX improvements
- [x] Swipe-to-delete gesture on material cards (mobile)
- [x] Filter pills by material type (horizontal scrollable row)
- [x] Search input to filter materials by title

## Feature: My Materials - sort, bulk delete, share
- [x] Sort toggle (newest/oldest/A-Z) on My Materials page
- [x] Bulk delete mode: select multiple cards and delete all at once
- [x] Share link: generate a read-only public link for any material

## Feature: PARAULA challenge room
- [x] Server procedure to create a PARAULA room from a saved paraula material
- [x] Teacher lobby: show room code + QR, list students as they join
- [x] Student join flow: enter room code, see the PARAULA board, play live
- [x] Live leaderboard: show scores after each round

## Feature: PARAULA viewer enhancements + live student room
- [x] Inline word/clue editor in PARAULA material viewer (edit words and clues after generation)
- [x] Print word list button in PARAULA material viewer (clean printable sheet)
- [x] Live PARAULA student room: real-time room where all students play the same word simultaneously
- [x] Teacher leaderboard view: see who guessed the word and in how many tries
- [x] Student join flow for PARAULA live room: enter room code, play the game, submit score

## Bug: PARAULA game does not reset between rounds
- [x] Diagnose why the PARAULA board/keyboard state persists after a round ends
- [x] Reset board tiles, keyboard letter states, guesses array, and current row on new round start
- [x] Ensure the new target word is applied cleanly without stale state

## Bug: PARAULA mobile live/play layout
- [x] Audit Join.tsx PARAULA game section for mobile overflow and cramped layout
- [x] Make the 6×5 game board tiles responsive (smaller tiles on small screens)
- [x] Make the Catalan/Spanish keyboard keys responsive (smaller keys, no overflow)
- [x] Ensure clue banner, score header, and done screen are readable on mobile
- [x] Test on 375px viewport width (iPhone SE)

## Feature: PARAULA multi-round mode
- [x] Add nextParaulaRound server procedure: picks next word from material, resets room status to 'waiting', clears participant scores for the new round
- [x] Teacher leaderboard view: add "Next Word" button (visible after all students have submitted or teacher chooses to advance)
- [x] Teacher leaderboard: show current round number (e.g. "Round 2 of 5")
- [x] Student join flow: detect round change via polling and reset the game board automatically
- [x] Student done screen: show "Waiting for next round..." state instead of static done screen

## Feature: Student result screen — emoji share grid
- [x] After student submits PARAULA score, show their emoji guess grid (🟩🟨⬛)
- [x] Add "Copy result" button that copies the share text to clipboard
- [x] Show number of guesses and whether they won or ran out
- [x] i18n keys for share text and copy button (EN/ES/CA)

## Feature: Log PARAULA live sessions to group_challenge_log
- [x] Extend finishParaulaRoom server procedure to accept optional groupId
- [x] Write a group_challenge_log row with competencies from the linked material
- [x] Teacher results view: show "Save to Group" dialog (same as MCQ challenge) after ending a PARAULA room
- [x] Wire saveChallengeToGroup to also handle paraula_live room type

## Bug: Server error when Start Challenge button is clicked
- [x] Diagnose the tRPC/server error triggered by the Start Challenge button
- [x] Fix the root cause and verify the challenge creation flow works end-to-end

## Bug: PARAULA game does not reset or indicate correct answer
- [x] Game board does not reset when a new round starts (tiles/keyboard persist)
- [x] No visual indication when the correct word is guessed (win state not shown)
- [x] Winning row should animate/highlight green and show a celebration message
- [x] After winning, show emoji share grid and "Waiting for next round" state

## Bug: PARAULA grid does not reset after correct answer is entered
- [x] Grid tiles and keyboard persist after the correct word is guessed within the same round
- [x] Fix so that entering the correct answer shows the win overlay then clears the board for re-play or next round

## Feature: PARAULA tile flip animation
- [x] Add CSS keyframe animation for tile reveal (rotateX flip) in index.css
- [x] Stagger tile flip per column (col 0 = 0ms, col 1 = 100ms, col 2 = 200ms, col 3 = 300ms, col 4 = 400ms)
- [x] Show tile colour only after flip completes (start grey, reveal green/yellow/grey on flip)
- [x] Add pop animation when typing a letter into a tile

## Feature: PARAULA word length validation in teacher word-picker
- [x] In Challenge.tsx word-picker dialog, check each word's length
- [x] Show a red warning badge next to any word that is not exactly 5 letters
- [x] Disable the "Start Round" button if the selected word is not 5 letters
- [x] Show tooltip explaining the 5-letter requirement

## Feature: PARAULA Web Audio sound effects
- [x] Play a soft chime when a guess row is submitted (correct or not)
- [x] Play a fanfare/win sound when the correct word is guessed
- [x] Play a low tone when all guesses are used without solving
- [x] Use Web Audio API only (no external files or dependencies)
- [x] Respect user preference: add a mute toggle button in the game header

## Bug: PARAULA clue label and game strings do not change language
- [x] "Clue" label in LiveParaulaGame is hardcoded English — use t() for i18n
- [x] "5 letters needed", "Submitting score…", "The word was", "Solved in X guesses" are all hardcoded — translate all
- [x] Mute button tooltip "Mute sounds" / "Unmute sounds" should use t()
- [x] Add missing i18n keys for all PARAULA game strings in EN, ES, CA

## Feature: PARAULA keyboard language toggle
- [x] Add CA/ES keyboard toggle button in LiveParaulaGame (Catalan: Ç, Catalan accents; Spanish: Ñ)
- [x] CA keyboard: standard QWERTY + Ç key
- [x] ES keyboard: standard QWERTY + Ñ key
- [x] Persist keyboard choice in localStorage so it survives page refresh
- [x] Add i18n key paraula_kb_toggle in EN/ES/CA

## Feature: PARAULA solo practice mode
- [x] Add "Practice" entry point in the PARAULA material viewer (MaterialView.tsx)
- [x] Create ParaulaPractice page where student picks a word from the material and plays solo
- [x] Show all 5-letter words as selectable cards with search filter
- [x] Solo game uses embedded SoloParaulaGame component (no room/participant IDs)
- [x] After finishing, show result with emoji grid, copy button, Try Again, Choose Another Word
- [x] Register route /paraula-practice in App.tsx

## Feature: Teacher word-picker search filter
- [x] Add a text input at the top of the word-picker dialog in Challenge.tsx
- [x] Filter the word list in real-time as the teacher types (word + clue search)
- [x] Preserve original word index mapping so correct wordIndex is sent to nextParaulaRound

## Feature: School Calendar event buttons
- [x] Activate Holiday, Special Day, Exam, Excursion, Event, Lesson, AI Lesson buttons
- [x] Add/update calendar_events DB table with type, title, date, notes, color fields
- [x] Server procedures: createCalendarEvent, listCalendarEvents, deleteCalendarEvent
- [x] Event creation dialog: date picker, title input, notes, triggered by each button type
- [x] AI Lesson button: pre-fills dialog with AI-generated lesson plan suggestion
- [x] Render events on calendar grid with colour-coded dots/badges per event type
- [x] Click a day to see all events for that day in a popover/panel
- [x] Delete event from day detail view

## Bug: Aina wake-word voice activation not working
- [x] Saying "Aina" does not trigger the voice assistant
- [x] Diagnose the wake-word detection implementation (Web Speech API / SpeechRecognition)
- [x] Fix the transcript matching logic so "aina" (case-insensitive) reliably triggers activation
- [x] Ensure the microphone permission is requested and continuous listening is active

## Feature: Aina wake-word DevTools logging improvements
- [x] Add structured console.group/groupEnd for wake listener lifecycle events
- [x] Log detected transcript and matched variant when wake word fires
- [x] Log language, backoff value, and session duration on each restart
- [x] Add [Aina] prefix to all log messages for easy filtering

## Feature: Aina wake-word confirmation toast
- [x] Show a brief on-screen toast ("Aina activated — speak now") when wake word is detected
- [x] Toast should appear near the Aina chat button (bottom-right) not at the top of the screen
- [x] Auto-dismiss after 2 seconds
- [x] Add i18n keys for the toast message in EN/ES/CA

## Feature: Aina dual-language parallel listener (CA + ES)
- [x] Run two SpeechRecognition instances simultaneously: one in ca-ES, one in es-ES
- [x] Both instances listen for the same wake word "Aina"
- [x] When either instance detects the wake word, stop both and start the input session
- [x] Input session language follows the app's current language setting
- [x] Avoid double-activation race condition (use a shared "activating" flag)

## Feature: PARAULA "New Game" button
- [x] Add "New Game" button to solo practice game view (ParaulaPractice.tsx) that resets the grid and picks a new word
- [x] Add "New Game" button to live game done/result screen (Join.tsx) that resets the grid for another attempt on the same word
- [x] Ensure full reset: guesses array, current row, current col, game status, tile colours, keyboard colours
- [x] Button visible on the result/done screen and also accessible mid-game (with a confirmation or as a secondary action)
- [x] Add i18n keys for "New Game" in EN/ES/CA

## Bug: PARAULA does not show win message when correct word is entered
- [x] Show immediate in-game toast/banner "Correct! 🎉" when the correct word is guessed (before overlay appears)
- [x] Win overlay must appear promptly and clearly after the flip animation completes
- [x] Loss overlay must show the correct word clearly

## Bug: PARAULA not optimised for mobile
- [x] Tile size should scale down gracefully on small screens (320px–375px viewports)
- [x] Keyboard keys must be large enough to tap on mobile (min 36px height)
- [x] Game container must not overflow horizontally on mobile
- [x] Result screen buttons must be full-width and easily tappable on mobile
- [x] Header and clue bar must not overlap game grid on small screens

## Bug: School Calendar not optimised for mobile/tablet
- [x] On mobile: replace 7-column grid with a vertical list/agenda view of events grouped by day
- [x] On tablet (md): show a compact 7-column grid with smaller cells and abbreviated day names
- [x] Quick-add event type buttons should wrap/scroll horizontally on small screens
- [x] Event chips in grid cells must truncate with ellipsis and not overflow on small screens
- [x] Month navigation (prev/next) must be easily tappable on mobile (min 44px touch targets)
- [x] Add a toggle between "Grid" and "Agenda" view on mobile
- [x] Ensure the page header and controls do not overlap the calendar grid on small screens

## Bug: Hard-coded English strings throughout app
- [x] Audit all pages/components and replace every hard-coded English string with t() calls
- [x] Add all missing keys to I18nContext in EN, ES, and CA

## Feature: Rename ClaraProfilePanel to AinaProfilePanel
- [x] Rename component file ClaraProfilePanel.tsx → AinaProfilePanel.tsx
- [x] Update all imports across the codebase
- [x] Rename exported component function/const from ClaraProfilePanel to AinaProfilePanel
- [x] Replace any visible "Clara" text in the panel UI with "Aina"
- [x] Update i18n keys: removed obsolete clara_* keys from I18nContext (EN/ES/CA); aina_* keys already in place
- [x] All t("aina_*") calls already correct in AinaProfilePanel.tsx

## Bug: Lesson planners not AI-completed when calendar event is created
- [x] Trace the calendar event creation → lesson plan AI generation flow
- [x] Identify why the AI completion is not triggered or fails silently
- [x] Fix the trigger so lesson plans are auto-completed by AI when a calendar event is opened (plan sheet)
- [x] Ensure errors surface to the user rather than failing silently

## Feature: View lesson planner from calendar date selection
- [x] When a teacher clicks a date in the calendar, the day panel shows all events for that day
- [x] Each event in the day panel should have a "View Plan" / "Open Lesson Plan" button
- [x] Clicking "View Plan" opens the inline lesson plan sheet for that event
- [x] If no plan exists yet, AI auto-generates one (existing flow)
- [x] If a plan already exists, it loads immediately into the sheet
- [x] Show a plan indicator icon/badge on events that already have a linked lesson plan

## Feature: CSV/XML export for all print modes
- [x] Create shared exportToCsv(filename, rows) and exportToXml(filename, rootTag, rows) utility functions in client/src/lib/exportUtils.ts
- [x] MaterialView: add CSV and XML export buttons for quiz, flashcards, missing_words, wordsearch, crossword, slides
- [x] SampleQuestions: add CSV and XML export buttons to the worksheet export dialog
- [x] LessonPlanner: add CSV and XML export buttons to the print/export dialog
- [x] SchoolCalendar: add CSV and XML export buttons for calendar events
- [x] Presentation: add CSV and XML export buttons for slide content
- [x] Challenge: add CSV and XML export buttons for session results
- [x] Add i18n keys for "Export CSV" and "Export XML" in EN/ES/CA

## Feature: Unified Export dropdown menu
- [x] Create shared ExportDropdown component with Print, PDF, PNG, Word, CSV, XML options
- [x] Replace individual export buttons in MaterialView with ExportDropdown
- [x] Replace individual export buttons in SampleQuestions with ExportDropdown
- [x] Replace individual export buttons in LessonPlanner with ExportDropdown
- [x] Replace individual export buttons in SchoolCalendar with ExportDropdown
- [x] Replace individual export buttons in Presentation with ExportDropdown
- [x] Replace individual export buttons in Challenge results with ExportDropdown

## Feature: Batch lesson plan creation from calendar
- [x] Add "Generate All Plans" button to SchoolCalendar toolbar
- [x] Dialog shows all events in current month that don't yet have a linked lesson plan
- [x] Teacher can select/deselect individual events before generating
- [x] On confirm, call aiGenerateLessonPlan for each selected event in sequence
- [x] Show progress bar/counter (e.g. "Generating 3 of 7...")
- [x] Show success/failure summary when batch is complete
- [x] Add i18n keys for batch generation UI in EN/ES/CA

## Bug: Lesson plan sheet does not open when selected from calendar day panel
- [x] Clicking "View Plan" / "Add Plan" on a calendar event in the day panel does not open the plan sheet
- [x] Root cause: two sibling Radix Sheet components racing during open/close cycle
- [x] Fix: replaced two separate open booleans with a single activePanel state machine so only one Sheet is ever open at a time

## Feature: Lesson plan deletion from School Calendar plan sheet
- [x] Add a "Delete Plan" button (with confirmation) inside the lesson plan sheet header
- [x] Server: add deleteLessonPlan procedure that removes the plan row and unlinks it from the calendar event
- [x] After deletion, close the plan sheet and refresh the event plan map
- [x] Add i18n keys for delete confirmation dialog in EN/ES/CA

## Bug: Duplicate lesson plans created for the same calendar event
- [x] Server: in createLinkedLessonPlan, check if a plan already exists for the calendarEventId before inserting
- [x] If a plan already exists, return the existing plan id instead of creating a new one
- [x] Client: in openPlanSheet, skip calling createLinkedPlanMutation if eventPlanMap already has a plan for the event

## Feature: Re-generate plan button in lesson plan sheet
- [x] Add a "Re-generate" button (Sparkles icon) in the plan sheet header next to Save
- [x] Clicking it triggers aiGenerateLessonPlan for the current plan and shows the loading overlay
- [x] Button is disabled while AI is generating or while saving
- [x] Add i18n keys: lp_regenerate, lp_regenerate_confirm_title, lp_regenerate_confirm_desc in EN/ES/CA
- [x] Show AlertDialog confirmation before re-generating (warns existing content will be overwritten)

## Feature: Challenge per-question CSV breakdown export
- [x] In Challenge results view, add a "Per-question breakdown" section showing each question, correct answer, and per-student response
- [x] Export this breakdown as CSV via the existing ExportDropdown
- [x] CSV columns: Question, Correct Answer, then one column per student showing their answer and whether it was correct
- [x] Add i18n keys for the breakdown section heading and CSV filename in EN/ES/CA

## Feature: PARAULA word difficulty filter (1–3 star rating)
- [x] Add a difficulty field (1, 2, or 3) to the PARAULA word list (stored in material content JSON)
- [x] In the Create page PARAULA editor, show star-rating buttons next to each word/clue row
- [x] In solo practice mode, add a difficulty filter (1★ / 2★ / 3★ / All) to the word selection screen
- [x] Persist selected difficulty in localStorage
- [x] Add i18n keys for difficulty labels in EN/ES/CA

## Feature: Direct link from calendar lesson events to lesson plans
- [x] Each lesson/ai_generated event tile on the month grid shows a small plan-link icon when a plan exists
- [x] Clicking the event tile (or the plan icon) opens the plan sheet directly for that event
- [x] In the day panel event list, each event row has an "Open Plan" button that opens the plan sheet
- [x] Events without a plan show an "Add Plan" affordance instead
- [x] Add i18n keys for open_plan, add_plan tooltips in EN/ES/CA

## Feature: Include lesson number and date in lesson plan
- [x] DB: add lessonDate (varchar) column to lessonPlans table via migration
- [x] Server: in createLinkedLessonPlan, compute lessonNumber by counting lesson/ai_generated events up to this event's date in the same calendar
- [x] Server: store lessonDate from the calendar event's eventDate
- [x] Client: display lesson number and date as subtitle in the plan sheet header
- [x] Add lp_lesson_number_label i18n key in EN/ES/CA

## Bug: Plan sheet not opening as small side-panel window when selected from calendar
- [x] Root cause: SheetOverlay was full-screen black/50 on all screen sizes, making it feel like a modal takeover
- [x] Fix: Created PlanSheetContent variant with transparent overlay on sm+ screens so calendar remains visible behind the 520px side panel
- [x] Plan sheet now opens as a true right-side drawer on desktop (520px wide, no overlay dimming)

## Fix: Lesson number always counts from first September lesson event
- [x] In createLinkedLessonPlan, derive September anchor from academicYear label (e.g. "2025-2026" → 1 Sep 2025)
- [x] Count all lesson/ai_generated events from that September anchor up to and including the current event's date
- [x] This ensures Lesson 1 = first school day in September regardless of when the plan was created

## Feature: Lesson plan PDF export
- [x] Add Export PDF button (FileDown icon, blue) to plan sheet header
- [x] Server: generateLessonPlanPdf helper using PDFKit; exportLessonPlanPdf tRPC procedure uploads to S3 and returns URL
- [x] Client: download triggered via anchor click on returned S3 URL
- [x] Add lp_export_pdf i18n key in EN/ES/CA

## Feature: Lesson number editable override
- [x] Replace static lesson number display in plan sheet header with an inline input field
- [x] Editing the lesson number marks the form as dirty so it is saved with the plan

## Feature: Challenge history per class group
- [x] Add getChallengeHistory procedure in progress.ts (last 20 sessions with per-question participant data)
- [x] Add History tab to GroupProgress.tsx with collapsible session cards
- [x] Each session card shows date, participant count, avg score, per-question accuracy bar, and leaderboard
- [x] Add gp_tab_history and gp_history_* i18n keys in EN/ES/CA

## Feature: Auto-insert Spanish/Catalan holidays on calendar creation
- [x] Built Spanish national + Catalan regional holiday dataset in server/spanishHolidays.ts (2024-25 and 2025-26)
- [x] createCalendar auto-inserts holiday events for all dates within the calendar's term dates
- [x] Holiday events use eventType "holiday" with the holiday name as the title

## Feature: Multi-day-of-week lesson selection in Edit Calendar
- [x] Added lessonDays varchar column to schoolCalendars schema
- [x] DB migration applied via migrate-lesson-days.mjs
- [x] Create and Edit Calendar dialogs now show Mon-Fri day-toggle buttons for multi-day selection
- [x] aiInfillCalendar distributes lessons across all selected lesson days
- [x] lessonDays passed to both aiInfillMutation.mutate calls in SchoolCalendar.tsx
- [x] Added cal_label_lesson_days and cal_lesson_days_hint i18n keys in EN/ES/CA

## Feature: Lesson plan print layout
- [x] Enhanced PDF with school name header, lesson number, date, teacher name, and two-column layout
- [x] exportLessonPlanPdf fetches the linked calendar to include schoolName and tutorName

## Feature: Challenge history CSV export
- [x] Added CSV download button (Download icon) to each session card in the Challenge History tab
- [x] CSV includes question, correct answer, and per-student response columns
- [x] Added gp_history_export_csv i18n key in EN/ES/CA

## Feature: PARAULA AI difficulty auto-assign
- [x] Added autoAssignParaulaDifficulty procedure to materials router using LLM
- [x] Added "AI Rate" button (Sparkles icon) in ParaulaPractice word picker
- [x] After auto-assign, material query invalidated to refresh star ratings
- [x] Added paraula_auto_rate i18n key in EN/ES/CA

## Feature: Lesson plan individual and batch delete buttons
- [x] Added Trash2 delete icon button on each lesson plan row in the plans list sidebar
- [x] Clicking individual delete opens AlertDialog confirmation before deleting
- [x] Added batch-select mode with checkboxes and Select All toggle
- [x] Batch delete shows AlertDialog with count of plans to be deleted
- [x] Server: added batchDeleteLessonPlans procedure in planner.ts using inArray
- [x] Added lp_batch_delete, lp_batch_delete_confirm_title, lp_batch_delete_confirm_desc i18n keys in EN/ES/CA

## Bug: Aina auto voice prompt does not reset on desktop after answer or stop
- [x] Root cause: Chrome SpeechSynthesis and SpeechRecognition share the audio device; wake listener restart timer fires while TTS is still playing and fails silently
- [x] Fix: added forceRestart export to useAinaWakeWord that schedules a fresh restart with 300ms delay
- [x] Fix: AIChatBox calls forceRestart 400ms after TTS last chunk ends (natural completion)
- [x] Fix: AIChatBox calls forceRestart 400ms after stopSpeaking (user presses Stop)
- [x] Fix: forceRestart also fires on TTS onerror so error paths also recover

## Feature: Calendar region selector for auto-inserting regional holidays
- [x] Expanded spanishHolidays.ts to cover all 17 autonomous communities (2024-25 and 2025-26)
- [x] Added region varchar column to school_calendars table via migrate-region.mjs
- [x] Updated createCalendar and updateCalendar input schemas to accept region
- [x] Updated holiday auto-insert logic to use the selected region
- [x] Added region selector (Select dropdown with all 17 communities + National only) to Create Calendar dialog
- [x] Added region selector to Edit Calendar dialog
- [x] Added cal_label_region and cal_region_hint i18n keys in EN/ES/CA

## Feature: View/Edit button on student group page (/groups/:id/student)
- [x] Add a "View / Edit" button on each content card in the student group page
- [x] Clicking the button opens a preview/edit dialog showing the full content
- [x] Teacher can edit the content in the dialog before issuing it to students
- [x] Save changes back to the content record
- [x] i18n keys already present in EN/ES/CA (sp_edit_assignment, sp_view_assignment, sp_ai_assignment_preview)

## Feature: LessonPlanner AI Generate dialog — Date, Session Time, Topic inputs + Calendar insertion
- [x] Add Date picker input to "Generate with AI" dialog in LessonPlanner.tsx
- [x] Add Session Time input (e.g. 09:00–10:00) to the dialog
- [x] Add Topic/Unit input to the dialog
- [x] On successful generation, create a calendar event on the selected date and link the plan to it
- [x] If no calendar exists yet, prompt user to create one first (or auto-select the first available)
- [x] Add i18n keys for lp_date, lp_session_time, lp_topic, lp_add_to_calendar in EN/ES/CA

## Fix: SchoolCalendar plan sheet — Skills, Systems, Procedure, Unit, Lesson Number, Day/Date/Session Time
- [x] Pass existing planSheetPlanId to aiGenerateLessonPlan so it updates the linked plan (not a new row)
- [x] Add Day/Date row showing the lessonDate from the linked calendar event
- [x] Add editable Session Time field to the plan sheet header info section
- [x] Ensure Skills & Language Systems card is always visible (not hidden when empty)
- [x] Ensure Lesson Procedure card is always visible with default stages when empty
- [x] Ensure Unit and Lesson Number fields are pre-populated from the linked calendar event

## Fix: School Calendar month view — academic week numbers
- [x] Replace ISO week numbers with academic week numbers (Week 1 = first week of September of the academic year)

## Feature: Edit Calendar event — time slot field + time-clash detection
- [x] Add startTime and endTime columns to school_calendar_events table (migration)
- [x] Add startTime/endTime fields to createCalendarEvent and updateCalendarEvent procedures
- [x] Add time slot inputs (start time, end time) to the Add/Edit event dialog in SchoolCalendar.tsx
- [x] On save, detect time clashes (same date, overlapping times) and show a warning toast/alert
- [x] Show time slot in the event chip on the month grid and day panel
- [x] Add i18n keys for time_slot, start_time, end_time, time_clash_warning in EN/ES/CA

## Feature: Term Overview — highlight holiday/non-teaching weeks
- [x] In Term Overview, visually distinguish weeks that contain only holidays (no lessons) with a muted row style

## Feature: Lesson plan PDF — academic week number in header
- [x] Include the academic week number in the exported lesson plan PDF header alongside the date

## Feature: School Calendar — jump-to-week navigation
- [x] Add a "Go to week…" input (type W12 or pick from dropdown) that jumps the calendar to that academic week

## Fix: Lesson plan auto-numbering
- [x] Auto-assign lessonNumber when a lesson plan is created (sequential within the same calendar, ordered by date)
- [x] Fix createLinkedLessonPlan to compute lessonNumber from existing plans in the calendar
- [x] Fix aiGenerateLessonPlan to preserve/set lessonNumber when updating the linked plan

## Feature: Re-number existing lesson plans
- [x] Add renumberPlans tRPC procedure that reorders all plans in a calendar by lessonDate and assigns sequential numbers
- [x] Add "Re-number Plans" button in the calendar plan sheet or settings area
- [x] Add i18n keys for renumber_plans, renumber_plans_success in EN/ES/CA

## Feature: Lesson number badge on plan cards
- [x] Show lesson number as a visible badge on each plan card in the Lesson Planner list view
- [x] Badge should display "L{number}" (e.g. L3) in a teal/accent colour

## Feature: Session Time in lesson plan PDF
- [x] Add sessionTime field to the lessonPlanPdf.ts header section
- [x] Wire sessionTime through exportLessonPlanPdf procedure input
- [x] Show time alongside date and academic week in the PDF header

## Bug: Lesson plan numbers not showing on plan cards or info card
- [x] Trace lessonNumber from DB → getLessonPlan → planToLessonForm → plan sheet Lesson No. field
- [x] Trace lessonNumber from DB → listLessonPlans → plan list card badge
- [x] Fix the root cause: backfilled lessonDate+lessonNumber for all 60 existing plans; fixed createLinkedLessonPlan to backfill on re-open; removed falsy guard on inline number display; invalidate cache on plan open

## Bug: Context & Resources card not populating in lesson plan sheet
- [x] Find Context & Resources fields in LessonFormState and planToLessonForm
- [x] Check AI prompt returns these fields and they are mapped correctly
- [x] Fix root cause: server now returns JSON-stringified fields; frontend immediately populates form from mutation response before cache re-fetch; getLessonPlan cache invalidated before fetch in both LessonPlanner and SchoolCalendar

## Bug: Session time inputs not showing in Edit Calendar event dialog
- [x] Find start/end time fields in the Add/Edit event dialog JSX
- [x] Fix rendering issue: time fields were in Add/Edit event dialogs but NOT in the Edit Calendar settings dialog
- [x] Added Default Session Time fields to Edit Calendar dialog (saved to DB)
- [x] Pre-fill Add Event form with calendar default times when opening the dialog

## Feature: Bulk-apply default session time to existing events
- [x] Add applyDefaultTimeToEvents tRPC procedure that updates all lesson events in a calendar with the calendar's defaultStartTime/defaultEndTime
- [x] Add "Apply to all lessons" button in the Edit Calendar dialog's Default Session Time section
- [x] Add i18n keys for cal_apply_to_all_lessons, cal_apply_to_all_lessons_success in EN/ES/CA

## Feature: Recurring weekly lesson events
- [x] Add repeat field (none/weekly/fortnightly) to the Add Event dialog
- [x] Add createRecurringEvents tRPC procedure that creates multiple events on the same weekday until the calendar end date
- [x] Each recurring event inherits the same title, type, subject, year group, and times
- [x] Add i18n keys for cal_repeat, cal_repeat_none, cal_repeat_weekly, cal_repeat_fortnightly in EN/ES/CA

## Feature: Auto-populate sessionTime on linked lesson plan from calendar event
- [x] When createLinkedLessonPlan runs, if the event has startTime/endTime, set sessionTime on the plan as "HH:MM–HH:MM"
- [x] When createCalendarEvent runs with startTime/endTime and a linked plan exists, update the plan's sessionTime

## Feature: Delete recurring event series
- [x] Add seriesId column to school_calendar_events table (migration)
- [x] Update createRecurringEvents to stamp all created events with the same seriesId (UUID)
- [x] Add deleteEventSeries tRPC procedure that deletes all events with the same seriesId
- [x] In Edit Event dialog, show "Delete this event" vs "Delete entire series" options when seriesId is present
- [x] Add i18n keys for cal_delete_series, cal_delete_series_confirm in EN/ES/CA

## Feature: Bulk PDF export of all lesson plans
- [x] Add exportAllLessonPlansPdf tRPC procedure that fetches all plans for a calendar ordered by lessonNumber and generates a combined PDF
- [x] Add "Export All Plans" button in LessonPlanner page header
- [x] Show loading spinner while PDF is being generated
- [x] Add i18n keys for lp_export_all, lp_export_all_generating in EN/ES/CA

## Feature: Academic week numbering from calendar start date
- [x] getAcademicWeek in SchoolCalendar.tsx anchors Week 1 to Monday on/before calendar startDate
- [x] academicWeekNumber in server/calendarPdf.ts updated to accept calendarStartDate and use it when present

## Feature: Start/end date in Edit Calendar + LOMLOE AI alignment
- [x] Add startDate and endDate fields to Edit Calendar dialog for full_year and topic_block calendar types
- [x] Persist startDate/endDate changes through the updateCalendar tRPC procedure
- [x] Update AI generate (createRecurringEvents / AI infill) prompt to align with all 8 LOMLOE competencies and Catalan curriculum preferences
- [x] Add i18n keys for new date fields in EN/ES/CA

## Feature: 3 term date ranges in Edit Calendar (Catalonia 3-semester support)
- [x] Add term1Start, term1End, term2Start, term2End, term3Start, term3End columns to school_calendars table
- [x] Run migration SQL for new columns
- [x] Update updateCalendar and createCalendar tRPC procedures to accept all 3 term ranges
- [x] Add 3 term date range fields to Edit Calendar dialog (full_year type)
- [x] Wire AI infill to pass all 3 term ranges as termDates to the server
- [x] Add i18n keys for term labels in EN/ES/CA

## Feature: 3 term date ranges in Edit Calendar + AI clash detection
- [x] Run DB migration: add term1Start, term1End, term2Start, term2End, term3Start, term3End to school_calendars
- [x] Update createCalendar and updateCalendar tRPC procedures to accept all 3 term date pairs
- [x] Add term1/2/3 fields to emptyCalForm and calForm state
- [x] Add Term 1, Term 2, Term 3 date pickers to Edit Calendar dialog (full_year only)
- [x] Populate term fields when opening the edit pencil dialog from a saved calendar
- [x] Pre-fill AI infill term dates from saved term1-3 fields when opening the AI Generate dialog
- [x] Add clash detection to aiInfillCalendar: return list of clashing dates (lessons on holidays/existing events)
- [x] Show clash warning dialog after AI-generated lessons are inserted
- [x] Add i18n keys for term labels and clash warning in EN/ES/CA
- [x] Add active navigation link from lesson plan preview (calendar event sheet/card) to the full LessonPlanner editor page

## Feature: Desktop mic/speaker controls in School Calendar
- [x] Add microphone device selector (dropdown of available audio input devices) to desktop calendar toolbar
- [x] Add speaker volume slider to desktop calendar toolbar (hidden on mobile)
- [x] Persist selected mic device and volume level in localStorage
- [x] Add i18n keys for mic/speaker labels in EN/ES/CA

## Feature: Catalan public holiday auto-seed
- [x] Define list of Catalan public holidays (Diada, Castanyada, Sant Jordi, Pasqua, etc.) with annual recurrence logic
- [x] Add seedCatalanHolidays tRPC procedure that inserts holidays within the calendar's term date ranges
- [x] Add "Seed Catalan Holidays" button in Edit Calendar dialog (shown when term dates are set)
- [x] Add i18n keys in EN/ES/CA

## Feature: Per-term lesson coverage badge
- [x] Compute filled vs available lesson days per term from calendar events
- [x] Show a small progress bar/badge per term in the calendar sidebar term overview
- [x] Add i18n keys in EN/ES/CA

## Feature: Clash resolution shortcut in clash warning dialog
- [x] Add "Skip clashing dates & re-run" button to the clash warning dialog
- [x] Re-invoke aiInfillCalendar with excludeDates list of the clashing dates
- [x] Add i18n keys in EN/ES/CA

## Feature: Easter-aware Catalan holiday recurrence
- [x] Implement anonymous Gregorian algorithm (Meeus/Jones/Butcher) to compute Easter Sunday for any year
- [x] Replace hardcoded Easter dates in seedCatalanHolidays with computed dates
- [x] Derive Divendres Sant, Dilluns de Pasqua, Dilluns de Pentecosta, Dijous Sant, Ascensió, Corpus Christi from computed Easter
- [x] Extended with full Carnival week (Dijous Gras, Divendres/Dissabte/Dimarts de Carnestoltes)
- [x] Improved duplicate detection using YYYY-MM-DD string comparison

## Feature: Weekly term coverage email digest
- [x] Add weeklyTermCoverageDigest tRPC procedure that queries all calendars with term dates and computes T1/T2/T3 coverage
- [x] Filter to calendars with at least one term below 50% coverage
- [x] Format a readable text digest with progress bars and send via notifyOwner
- [x] Add a "Send coverage digest" button in the School Calendar sidebar for manual trigger
- [x] Add i18n keys in EN/ES/CA

## Bug: Lesson Information card not populated
- [x] Fixed nested button hydration error in calendar sidebar (outer button → div[role=button])
- [x] Fixed parseJsonField in both LessonPlanner.tsx and SchoolCalendar.tsx to handle already-parsed objects from AI mutation responses
- [x] Fixed plan sheet not re-populating when same plan is reopened (reset form to empty before setting planSheetPlanId so useEffect always fires)

## Bug: Lesson Procedure card not populated
- [x] Root cause: aiGenerateLessonPlan used free-form JSON prompt without response_format enforcement, causing LLM to sometimes omit procedures
- [x] Fixed: switched to response_format json_schema with strict procedures array schema
- [x] Added DEFAULT_PROCEDURES fallback so procedures is always non-empty even if LLM fails
- [x] Added try/catch around JSON.parse so a malformed LLM response no longer crashes the mutation

## Feature: Lesson title/number/duration pre-fill from calendar
- [x] AI infill generates unique per-lesson topic titles (not generic "Lesson 1", "Lesson 2")
- [x] Lesson number from calendar event is copied to lessonNumber field of Lesson Information card
- [x] Session duration from calendar's defaultSessionTime is copied to duration field of Lesson Information card
- [x] Lesson title from calendar event title is copied to title field of Lesson Information card

## Follow-up 1: Backfill existing plans with correct duration and session time
- [x] Add backfillPlanDurations tRPC procedure: for each plan linked to a calendar, compute duration and sessionTime from the event's start/end time (or calendar defaults), update the plan row
- [x] Wire a "Fix durations" button in the plan sheet header (or Edit Calendar dialog) that calls backfillPlanDurations for the selected calendar
- [x] i18n keys for button label and success toast in EN/ES/CA

## Follow-up 2: Show session time label next to Duration in Lesson Information card
- [x] SchoolCalendar plan sheet: render sessionTime as a read-only badge/label next to the Duration input in the Lesson Information card
- [x] LessonPlanner: same read-only sessionTime label next to Duration in the Lesson Information card
- [x] Only show the label when sessionTime is non-empty

## Follow-up 3: Session time editable in plan sheet
- [x] SchoolCalendar plan sheet: replace read-only session time badge with an editable Input field (marks form dirty on change, saved with the plan)
- [x] LessonPlanner: same editable session time Input next to Duration
- [x] i18n keys for placeholder/label if needed

## Follow-up 4: Duration sub-label on calendar lesson chips
- [x] Compute duration in minutes from event startTime/endTime (or calendar defaultStartTime/defaultEndTime) for each lesson/ai_generated event
- [x] Render a small duration badge (e.g. "44 min") on each lesson chip in the calendar grid
- [x] Only show when duration can be computed (both times present)

## Follow-up 5: Auto-update Duration when Session Time is edited
- [x] SchoolCalendar plan sheet: parse HH:MM–HH:MM from sessionTime onChange, compute duration, auto-set duration field
- [x] LessonPlanner: same auto-compute on sessionTime change

## Follow-up 6: Full time range in chip hover tooltip
- [x] All three chip locations: include startTime–endTime and duration in the title attribute (e.g. "08:45–09:29 · 44 min · View plan: Lesson Title")

## Follow-up 7: Duration column in lesson plans list view
- [x] Add Duration column to the lesson plan list/table in the plan sheet sidebar showing each plan's duration (min) at a glance

## Follow-up 8: Sort-by-lesson-number toggle in Lesson Planner sidebar
- [x] Add sort toggle button in sidebar header (default: by date/creation, alt: by lesson number ascending)
- [x] Sort logic applied to the plans list before rendering

## Follow-up 9: Total weekly teaching time in calendar week header
- [x] Compute sum of lesson durations for the displayed week from events with startTime/endTime
- [x] Show compact stat (e.g. "3h 42m teaching") in the week header row
- [x] Only show when at least one lesson with time data exists in the week

## Follow-up 10: Monthly teaching time summary in calendar header
- [x] Compute total lesson duration for the viewed month from eventsByDate
- [x] Show compact stat (e.g. "Sep · 18h 20m") next to the month/year title in the calendar card header

## Follow-up 11: Persist sort preference to localStorage
- [x] Read initial sortByLesson state from localStorage key "seba_planner_sort_by_lesson"
- [x] Write to localStorage on toggle

## Follow-up 12: Calendar filter dropdown in Lesson Planner sidebar
- [x] Fetch list of user's calendars in LessonPlanner
- [x] Add a filter Select dropdown above the plan list; "All calendars" default
- [x] Filter plans list to only show plans linked to the selected calendar

## Follow-up 13: Quick-jump from plan to linked calendar event
- [x] Add calendar icon button to each plan row in Lesson Planner sidebar (only shown when plan has calendarEventId)
- [x] Clicking navigates to /calendar?eventId=N&calendarId=M, opening the correct calendar and highlighting/opening the event
- [x] SchoolCalendar page reads the eventId query param on mount and opens the event's plan sheet or day panel

## AI Selective Generation: Only fill empty sections
- [x] Server: aiGenerateLessonPlan accepts existing field values (objectives, vocabulary, procedures, homework, assessment, materials, notes, etc.) and instructs the LLM to skip any field that already has content
- [x] Server: merge logic applies AI output only to fields that were empty in the request; pre-filled fields are preserved as-is in the saved plan
- [x] Client (LessonPlanner): pass all current form field values when calling aiGenerateLessonPlan so the server knows what is already filled
- [x] Client (SchoolCalendar plan sheet): same — pass current planForm values when triggering AI generation from the calendar

## Fix: AI Calendar Infill — Unique LOMLOE-Aligned Lesson Titles
- [x] aiInfillCalendar: generate unique, LOMLOE-aligned lesson titles per event using a dedicated LLM call that considers subject, year group, topic description, lesson number, and term position
- [x] Titles should reflect curriculum-appropriate topics (not generic "Lesson 1", "Lesson 2")

## Follow-up: Per-Section Regenerate Button
- [x] Add a small "Regenerate" icon button next to each content section in the lesson plan form (Learning Outcomes, Evaluation Criteria, Procedures, Materials, Previous Knowledge, Specific Competences, Saberes Básicos)
- [x] Clicking calls a new tRPC procedure aiRegenerateSection that generates only that one field using the plan context
- [x] Show loading spinner on the button while generating; update only that field on success

## Follow-up: Field-Level AI Generation Status Indicator
- [x] During full AI generation (aiGenerateLessonPlan), show a shimmer/skeleton on each section being generated (implemented as spinner on section regenerate buttons)
- [x] Sections that are pre-filled (existing values) show a "preserved" badge instead of a shimmer
- [x] Clear all indicators when generation completes

## Follow-up: Generation History / Undo
- [x] Before each AI generation, snapshot the current form state to a useRef
- [x] Show an 8-second "Undo" toast action after generation completes
- [x] Clicking undo restores the previous form state and marks the form as dirty

## Bug: Lesson plan AI generation not populating form fields
- [x] Diagnose why aiGenerateLessonPlan does not populate the lesson plan form after generation
- [x] Fix the root cause: (1) race condition — getLessonPlan.fetch was overwriting the form with a stale/null DB row before the insert committed; removed the re-fetch for new plans. (2) typo in server empty-check strings '[""]]' → replaced with robust anyNonEmpty() helper. (3) skills/systems default check replaced with anyTrue() helper that parses JSON and checks for any true value.

## Feature: Fill All Empty Sections button
- [x] LessonPlanner: add "Fill all empty sections" button in the plan header area; clicking it sequentially calls aiRegenerateSection for each blank section (specificCompetences, saberesBasicos, learningOutcomes, evaluationCriteria, previousKnowledge, materials, spaces, procedures) and updates the form after each
- [x] SchoolCalendar plan sheet: same button in the plan sheet header
- [x] Show a progress indicator (e.g. "Filling 3/6 sections...") while running
- [x] Disable all other AI buttons while fill-all is running
- [x] Snapshot form before starting for undo support

## Feature: Regenerate buttons for Skills & Language Systems card
- [x] SchoolCalendar plan sheet: add regenerate button to the Skills card header (regenerates skills section)
- [x] SchoolCalendar plan sheet: add regenerate button to the Language Systems card header (regenerates systems section)
- [x] LessonPlanner: same regenerate buttons on Skills and Language Systems cards

## Feature: Regenerate lesson title button
- [x] SchoolCalendar plan sheet: add small ↺ icon button next to the Lesson Title input
- [x] LessonPlanner: same button next to the Lesson Title field
- [x] Calls aiRegenerateSection with section="title"; updates only the title field on success (server enum updated to include "title" with LOMLOE-aligned prompt)

## Feature: Auto-save after fill-all completes
- [x] LessonPlanner: after handleFillAllEmpty loop finishes, call saveMutation automatically
- [x] SchoolCalendar plan sheet: after handleFillAllEmpty loop finishes, call savePlanMutation automatically
- [x] Show a "Saved" confirmation in the success toast

## Feature: Cross-calendar lesson plan duplication
- [x] Server: add copyLessonPlan tRPC procedure — copies all fields from source plan, accepts targetCalendarId and optional targetEventId, and auto-renumber option
- [x] Server: when autoRenumber=true, compute new lessonNumber based on target calendar event count
- [x] LessonPlanner: replace simple duplicate button with "Copy to…" dialog showing calendar picker + renumber toggle
- [x] LessonPlanner: same-calendar copy still works (no event link, no renumber needed)
- [x] SchoolCalendar plan sheet: add "Copy to calendar…" button in plan sheet header
- [x] i18n: add EN/ES/CA keys for copy dialog (copy_to_calendar, copy_plan_title, copy_target_calendar, copy_renumber, copy_success, copy_same_calendar)

## Feature: Event picker in copy-to-calendar dialog
- [x] Server: reuse existing listCalendarEvents tRPC procedure (already returns all events ordered by date for a calendarId)
- [x] Copy dialog (LessonPlanner + SchoolCalendar): after selecting a target calendar, show an optional event picker listing upcoming lesson slots (date + title + time)
- [x] Selecting an event links the copied plan to that event (passes targetEventId to copyLessonPlan); leaving it blank creates an unlinked copy
- [x] Auto-renumber respects the selected event's position when an event is chosen
- [x] i18n: add EN/ES/CA keys for event picker (lp_copy_target_event, lp_copy_no_event, lp_copy_event_placeholder, lp_copy_event_hint)

## Feature: Bulk copy of lesson plans
- [x] Server: add bulkCopyLessonPlans procedure (accepts planIds[], targetCalendarId?, autoRenumber) — calls copyLessonPlan logic for each plan in sequence
- [x] LessonPlanner batch-select mode: add "Copy to calendar…" button alongside existing "Delete" button in batch toolbar
- [x] Bulk copy dialog: calendar picker + renumber toggle (no event picker for bulk — too complex)
- [x] Show per-plan success/failure summary in toast after bulk copy completes
- [x] i18n: EN/ES/CA keys for bulk copy (lp_bulk_copy, lp_bulk_copy_dialog_title, lp_bulk_copy_success, lp_bulk_copy_desc)

## Feature: Conflict detection in event picker
- [x] Server: enrich listCalendarEvents response to include hasLinkedPlan boolean for each event
- [x] Copy dialog event picker: show a warning badge/icon on events that already have a linked plan
- [x] Tooltip or helper text explaining the conflict when hovering/selecting a conflicted slot
- [x] i18n: EN/ES/CA keys (lp_copy_event_conflict, lp_copy_event_conflict_hint)

## Feature: Replace existing plan on conflicted slot
- [x] Server: extend copyLessonPlan to accept replaceExisting boolean; when true and targetEventId is set, delete the existing linked plan before inserting the copy
- [x] Copy dialog (LessonPlanner + SchoolCalendar): when a conflicted slot is selected, show a "Replace existing plan" radio/toggle beneath the conflict warning
- [x] Default to "Create duplicate" (safe); user must explicitly choose "Replace"
- [x] i18n: EN/ES/CA keys (lp_copy_replace_existing, lp_copy_create_duplicate, lp_copy_replace_warning)

## Feature: Undo after replace-copy
- [x] Server: copyLessonPlan returns full snapshot of the deleted plan when replaceExisting=true
- [x] Server: add restoreDeletedPlan procedure that re-inserts a plan snapshot (accepts the full plan object)
- [x] LessonPlanner: on replace-copy success, show a 10-second Undo toast; clicking Undo calls restoreDeletedPlan and invalidates the list
- [x] SchoolCalendar: same Undo toast behaviour
- [x] i18n: EN/ES/CA keys (lp_copy_undo, lp_copy_undo_success, lp_copy_undo_desc)

## Feature: Bulk PDF export of lesson plans
- [x] Server: add bulkExportLessonPlansPdf procedure that accepts planIds[], generates individual plan PDFs and merges them into one combined PDF, returns an S3 URL
- [x] LessonPlanner batch-select toolbar: add "Download PDF" button next to the copy and delete buttons
- [x] Client: on success, trigger browser download of the combined PDF file
- [x] Show loading state on the button while PDF is generating
- [x] i18n: EN/ES/CA keys (lp_bulk_export_pdf, lp_bulk_export_pdf_generating, lp_bulk_export_pdf_success)

## Feature: Multiple calendar entries with clash detection
- [x] DB: add calendarSessions table (id, calendarId, name, lessonDays JSON, startTime, endTime, createdAt)
- [x] DB: run migration SQL
- [x] Server: add CRUD procedures for calendarSessions (create, update, delete, list)
- [x] Server: add clash-detection query — find sessions across all user's calendars that share a day and overlapping time window
- [x] SchoolCalendar: update calendar edit dialog to show a "Session Entries" section where teachers can add/remove multiple entries
- [x] Each entry row: name input, day-of-week toggle buttons (Mon–Fri), time pickers for start and end time
- [x] Clash indicator: amber ⚠ badge on any calendar in the sidebar whose sessions clash with another calendar's sessions
- [x] i18n: EN/ES/CA keys for session entries UI and clash warnings

## Bug Fix: Edit Calendar dialog footer button overlap
- [x] Split the footer into two rows: destructive actions (Seed Holidays, Delete) on the left, Cancel/Save on the right, with flex-wrap so they never overlap on narrow dialogs

## Feature: Clash detail popover on ⚠ badge
- [x] Clicking the amber ⚠ badge in the sidebar opens a popover listing each clash pair (entry A in Calendar X vs entry B in Calendar Y), shared days, and overlapping time range
- [x] Server extended to return sharedDays[], overlapStart, overlapEnd in each clash pair
- [x] i18n: uses existing cal_day_* keys for day names in EN/ES/CA

## Feature: Auto-fill new session entry from calendar defaults
- [x] When teacher clicks "Add Entry", pre-fill day toggles from the calendar's lessonDays field and start/end times from defaultStartTime/defaultEndTime

## Feature: Fix clash button in conflict popover
- [x] Each clash card in the popover gets a "Fix clash" button that closes the popover and opens the Edit Calendar dialog pre-loaded with the other (conflicting) calendar's settings
- [x] i18n: EN/ES/CA key (cal_clash_fix) — EN: "Fix clash in", ES: "Corregir conflicto en", CA: "Corregir conflicte a"

## Feature: Session entry templates
- [x] DB: add sessionTemplates table (id, userId, name, sessions JSON array, createdAt)
- [x] DB: run migration SQL
- [x] Server: add listSessionTemplates, saveSessionTemplate, deleteSessionTemplate procedures
- [x] Edit Calendar session entries section: "Save as template" button opens name-input dialog; saves current persisted + draft sessions as a reusable template
- [x] Edit Calendar session entries section: "Apply template" dropdown lists saved templates; selecting one replaces current drafts; each row has a delete button
- [x] i18n: EN/ES/CA keys added for all template strings (cal_session_save_template, cal_session_apply_template, cal_session_template_name_ph, cal_session_template_saved, cal_session_template_applied, cal_session_template_delete, cal_session_no_templates, cal_session_save_template_title, cal_session_save_template_desc)

## Task: Full i18n audit — replace all hard-coded English strings
- [x] Audit LessonPlanner.tsx for hard-coded strings
- [x] Audit SchoolCalendar.tsx for hard-coded strings
- [x] Audit remaining pages (Home, Settings, Dashboard, etc.) for hard-coded strings
- [x] Audit shared components (DashboardLayout, AIChatBox, etc.) for hard-coded strings
- [x] Add all missing keys to EN, ES, and CA sections of I18nContext.tsx
- [x] Verify 0 TypeScript errors after all changes

## Bug Fix: Missing Re-number Plans button in Lesson Planner
- [x] Add Hash icon import to LessonPlanner.tsx
- [x] Add renumberPlansMutation (trpc.planner.renumberPlans) to LessonPlanner.tsx
- [x] Add Re-number Plans button to Lesson Planner toolbar (visible when a plan is selected)
- [x] Add lp_renumber_no_calendar key to EN/ES/CA in I18nContext.tsx

## Bug Fix: Re-number Plans overwrites lesson titles
- [x] Inspect renumberPlans server procedure to see if it overwrites plan titles
- [x] Fix renumber logic so only lessonNumber is updated, not the plan title — CONFIRMED: already only sets lessonNumber
- [x] Verify fix in browser

## Feature: Batch "Fill all empty sections" button in Lesson Plans sidebar
- [x] Add onBatchFillAll prop to PlansList component
- [x] Add "Fill all empty" button in the PlansList footer (next to Generate with AI)
- [x] In LessonPlanner main component, implement handleBatchFillAll: iterate over all visible plans, call aiRegenerateSection for each blank section, auto-save each plan
- [x] Show progress toast during batch fill (e.g. "Filling plan 3 of 12...")
- [x] i18n: EN/ES/CA keys for lp_batch_fill_all, lp_batch_fill_progress, lp_batch_fill_done

## Bug Fix: "Export all plans" button not working
- [x] Inspect exportAllPlansMutation handler, dialog, and server procedure
- [x] Identify root cause: PDFKit switchToPage(0) out of bounds — PDFDocument was created without bufferPages:true, so page switching for footer rendering failed
- [x] Fix: added bufferPages:true to PDFDocument constructor and doc.flushPages() before doc.end() in server/lessonPlanPdf.ts
- [x] Verify PDF download works in browser (282-page PDF generated and opened successfully)

## Rename: "Class Challenge" → "Seba Classroom"
- [x] Find all occurrences of "Class Challenge" / "class challenge" / "class_challenge" in codebase
- [x] Update all EN/ES/CA i18n translation values in I18nContext.tsx (nav_challenge, challenge_title, challenge_subtitle, challenge_start, challenge_join, join_title, join_challenge_over, groups_no_challenges_hint, admin_stat_challenges, challenge_save_group_dialog_desc)
- [x] Rename in page components, navigation links, page titles, and route labels (all via i18n keys)
- [x] Rename in CSS comment (index.css)
- [x] Verify TypeScript 0 errors

## Follow-up: Implement pending follow-ups
- [x] Fix renumberPlans server procedure to retain lesson titles (only update lessonNumber, not title) — CONFIRMED: procedure already only sets lessonNumber, title is never touched

## Feature: Replace Gemini/Sparkles AI symbol with custom SEBA symbol
- [x] Create SEBA SVG symbol component (bold outlined style matching SEBA logo) as client/src/components/SebaSymbol.tsx
- [x] Replace all Sparkles icon usages in AIChatBox.tsx with SebaSymbol
- [x] Replace all Sparkles icon usages in NavBar.tsx with SebaSymbol
- [x] Replace all Sparkles icon usages in Create.tsx with SebaSymbol
- [x] Replace all Sparkles icon usages in LessonPlanner.tsx with SebaSymbol
- [x] Replace all Sparkles icon usages in SchoolCalendar.tsx with SebaSymbol
- [x] Replace all Sparkles icon usages in GroupProgress.tsx with SebaSymbol
- [x] Replace all Sparkles icon usages in StudentProgress.tsx with SebaSymbol
- [x] Replace all Sparkles icon usages in ParaulaPractice.tsx with SebaSymbol
- [x] Replace Sparkles in UpdateBanner.tsx, WhatsNewModal.tsx, WhatsNewBanner.tsx with SebaSymbol
- [x] Verify TypeScript 0 errors — clean build confirmed

## Feature: History tab in Seba Classroom page
- [x] Inspect existing challenge/session DB schema and server router
- [x] Add tRPC procedure: challenge.getSessionHistory (list past sessions with scores, group, date, leaderboard)
- [x] Add History tab to Seba Classroom page (Sessions / History tab switcher)
- [x] History list: show session date, room code, question count, participant count, top 3 medal scores
- [x] Expandable row / detail panel: full leaderboard with score bars per session
- [x] i18n: EN/ES/CA keys for all History tab labels (7 new keys × 3 languages = 21 entries)
- [x] TypeScript keys verified present in I18nContext.tsx (21 occurrences confirmed)

## Feature: Search and date-range filter in History tab (Seba Classroom)
- [x] Add search input to filter sessions by title or competency
- [x] Add date-from and date-to pickers to filter sessions by date range
- [x] Client-side filtering using useMemo (no server round-trip needed)
- [x] Show result count / empty state when no sessions match
- [x] Add clear-filters button when any filter is active
- [x] i18n: EN/ES/CA keys for all new filter labels
- [x] TypeScript 0 errors verified

## Feature: Help & Instructions page (Teacher dropdown, below Lesson Planner)
- [x] Create client/src/pages/Help.tsx — comprehensive instructions page with sections for every feature
- [x] Each section: feature name, step-by-step written instructions, embedded video placeholder (YouTube embed or placeholder card)
- [x] Features to cover: Aina Chat, Practice Questions, Progress Tracking, Group Progress, Create Material, Presentations, My Materials, Lesson Planner (full), School Calendar, Seba Classroom, Question Library, AI Accountability, Audit Dashboard, Privacy Dashboard
- [x] Add route /help to App.tsx
- [x] Add "Help & Instructions" nav item to Teacher dropdown in NavBar.tsx (below Lesson Planner)
- [x] i18n: EN/ES/CA keys for all Help page labels
- [x] TypeScript 0 errors verified

## Bug Fix: Seba Classroom page not translating
- [x] Identify which strings on the Seba Classroom (Challenge.tsx) page are not being translated
- [x] Fixed: 'Start PARAULA (N joined)' — added challenge_joined_count key (EN: joined / ES: conectados / CA: connectats)
- [x] Verify TypeScript 0 errors

## Bug Fix: TA Forum page not translating (including hard-coded strings)
- [x] Audit Forum.tsx for hard-coded English strings
- [x] Replace 8 hard-coded strings with t() calls (mic denied alert, TA Fòrum title, Me fallback, Aina label, hold-to-record tooltip, recording indicator, release-to-send hint, footer)
- [x] Add 7 missing keys to EN, ES, CA sections of I18nContext.tsx
- [x] Verify TypeScript 0 errors

## Feature: Export session history to CSV (Seba Classroom History tab)
- [x] Add "Export CSV" button to each expanded session row in Challenge.tsx History tab
- [x] Generate CSV client-side: columns = Rank, Student Name, Score, Correct Answers, Total Questions
- [x] Filename: seba-classroom-{roomCode}-{date}.csv
- [x] i18n: EN/ES/CA keys for challenge_history_rank, challenge_history_student, challenge_history_score, challenge_history_correct, challenge_history_total, challenge_history_export_csv
- [x] TypeScript 0 errors verified

## Feature: Lesson Planner template library
- [x] Confirmed: template system already fully implemented using lessonPlans.isTemplate flag
- [x] Existing procedures: saveAsTemplate, listTemplates, deleteTemplate (all working)
- [x] UI: Save as Template + Load Template buttons already in toolbar, dialogs already wired
- [x] Removed redundant lesson_plan_templates table/procedures (duplicate of existing system)
- [x] Added vitest tests for saveAsTemplate (3 cases), listTemplates (2 cases), deleteTemplate (1 case)
- [x] All 90 tests pass (9 test files)
- [x] TypeScript 0 errors verified

## Feature: Group filter dropdown in Seba Classroom History tab
- [x] Add historyGroupFilter state (string, default "all") to Challenge.tsx
- [x] Derive unique yearGroup values from sessionHistory data (sorted alphabetically)
- [x] Add "Filter by group" Select dropdown in the History tab filter bar (alongside search and date pickers)
- [x] Update filteredHistory useMemo to also filter by selected yearGroup
- [x] Show "All year groups" as the default option
- [x] i18n: EN/ES/CA keys for challenge_history_all_groups (EN: All year groups / ES: Todos los grupos / CA: Tots els grups)
- [x] TypeScript 0 errors verified (clean build confirmed)

## Nav: Rename Progress → Director + icon-only md breakpoint + back-to-top
- [x] Rename "Progress" nav button to "Director" (i18n keys nav_progress in EN/ES/CA)
- [x] Icon-only nav at md breakpoint, full labels at lg (NavBar.tsx desktop nav)
- [x] Sticky back-to-top button component (BackToTop.tsx) shown after 300px scroll
- [x] Wire BackToTop into App.tsx layout so it appears on all pages
- [x] TypeScript 0 errors verified

## Nav tooltip + adaptive back-to-top
- [x] Add tooltip to Teacher dropdown button (visible at md, hidden at lg when label shows)
- [x] BackToTop: use glass/white style on dark-background (classroom) pages, primary style elsewhere
- [x] TypeScript 0 errors verified

## 24-hour bias scan with auto-fix
- [x] Add biasScanRuns table to schema (id, runAt, incidentCount, fixesApplied, status, summary)
- [x] Generate and apply Drizzle migration SQL
- [x] Add server/biasScan.ts: runBiasScan() queries unresolved flags, invokes LLM for fix suggestions, persists results, notifies owner if incidents found
- [x] Add tRPC procedures: accountability.bias.runScan (admin), accountability.bias.listScans, accountability.bias.applyFix
- [x] Schedule runBiasScan() every 24h via server-side cron (node-cron)
- [x] Update BiasIncidentsTab UI: show last scan time, scan status badge, per-incident LLM fix suggestion, "Apply Fix" button
- [x] TypeScript 0 errors verified

## Bias scan export + schedule settings
- [x] Add tRPC procedure: accountability.bias.exportScanReport (returns CSV string, admin only)
- [x] Add tRPC procedure: accountability.bias.getScanSchedule / setScanSchedule (admin only)
- [x] Add appSettings table to schema for key-value config (bias_scan_hour, etc.)
- [x] Apply migration SQL for appSettings table
- [x] Hot-reload cron job when scan schedule changes
- [x] Update BiasIncidentsTab: Export button (CSV download) on scan history
- [x] Add ScanSchedulePanel component in Accountability page (time picker, save button)
- [x] TypeScript 0 errors, tests pass

## Calendar: Event detail view from selection
- [x] Add event detail popover/panel so clicking an event shows full details with "View Plan" and "Edit Event" actions
- [x] Non-lesson events: show detail popover with description, time, type, and Edit/Delete actions
- [x] Lesson events: show detail popover with plan status, description, time, and "Open Plan" / "Edit Event" actions

## Calendar: Three follow-up improvements
- [x] Add duplicate event action to detail popover (copy event to a new date)
- [x] Route Day Panel event chips through the detail popover instead of direct open
- [x] Add loading spinner to "Add Plan" button while AI generation is pending

## Calendar: Bulk duplicate + undo delete
- [x] Bulk duplicate event to multiple selected dates from detail popover
- [x] Undo delete: soft-delete with toast Undo action for calendar events

## Calendar: Day-total teaching hours badge + bulk-apply default times
- [x] Day-total teaching hours badge on month grid date cells
- [x] Bulk-apply default times to existing timeless calendar events (button in calendar toolbar)

## Director Dropdown Menu
- [ ] Add i18n keys for all 7 Director dropdown items (EN/ES/CA)
- [ ] Build Director dropdown in NavBar (unlinked from Teacher, mirrors Teacher dropdown pattern)
- [ ] Create stub page: School Overview (/director/overview)
- [ ] Create stub page: Staff Activity (/director/staff)
- [ ] Create stub page: Curriculum Compliance (/director/curriculum)
- [ ] Wire AI Accountability link (/accountability) in Director dropdown
- [ ] Create stub page: Student Progress (/director/progress)
- [ ] Create stub page: Reports & Exports (/director/reports)
- [ ] Create stub page: Settings & Permissions (/director/settings)
- [ ] Register all Director routes in App.tsx
