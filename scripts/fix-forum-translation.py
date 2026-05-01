"""
Fix the forum.ts translation pipeline:
1. Add a helper `needsTranslation(body, targetLang)` that uses the LLM to detect
   whether the message is already in the target language before translating.
2. Update all three translation blocks (getMessages, getDirectMessages, getThreadReplies)
   to skip translation when the message is already in the target language.
3. Also fix the prompt to be more robust: explicitly state the source detection and
   target language so the LLM doesn't paraphrase same-language text.
"""

path = "/home/ubuntu/seba-ai-studio/server/routers/forum.ts"

with open(path) as f:
    content = f.read()

# ── 1. Add the needsTranslation helper after the ONLINE_THRESHOLD_MS line ──
old_threshold = "const ONLINE_THRESHOLD_MS = 3 * 60 * 1000;"
new_threshold = """const ONLINE_THRESHOLD_MS = 3 * 60 * 1000;

/**
 * Returns true if the message body needs to be translated to targetLang.
 * Uses a lightweight LLM call to detect the source language.
 * Skips translation if the message is already in the target language,
 * is too short (≤3 chars), or is purely numeric/emoji.
 */
async function needsTranslation(body: string, targetLang: string): Promise<boolean> {
  const trimmed = body.trim();
  // Skip very short messages or purely non-alphabetic content
  if (trimmed.length <= 3 || !/[a-zA-ZÀ-ÿ\u00C0-\u024F]/.test(trimmed)) return false;
  try {
    const res = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `Detect the language of the following text. Reply with ONLY the ISO 639-1 language code (e.g. "en", "es", "ca", "fr"). Do not explain.`,
        },
        { role: "user", content: trimmed.slice(0, 200) },
      ],
    });
    const detected = (res.choices?.[0]?.message?.content ?? "").trim().toLowerCase().slice(0, 5);
    // If detected language matches target, no translation needed
    if (detected.startsWith(targetLang)) return false;
    return true;
  } catch {
    // On detection failure, proceed with translation (safe default)
    return true;
  }
}"""

content = content.replace(old_threshold, new_threshold, 1)

# ── 2. Fix getMessages translation block ──
old_getmsg = '''      // Auto-translate if preferred language is not English
      if (input.lang && input.lang !== "en") {
        for (const msg of messages) {
          if (!msg.body) continue;
          let translated: Record<string, string> = {};
          if (msg.translatedBodies) {
            try { translated = JSON.parse(msg.translatedBodies); } catch {}
          }
          if (!translated[input.lang]) {
            try {
              const res = await invokeLLM({
                messages: [
                  {
                    role: "system",
                    content: `Translate the following message to ${input.lang === "es" ? "Spanish" : "Catalan"}. Return only the translated text, nothing else.`,
                  },
                  { role: "user", content: msg.body },
                ],
              });
              const content = res.choices?.[0]?.message?.content;
              const translatedText = typeof content === "string" ? content.trim() : msg.body;
              translated[input.lang] = translatedText;
              await db
                .update(forumMessages)
                .set({ translatedBodies: JSON.stringify(translated) })
                .where(eq(forumMessages.id, msg.id));
              msg.translatedBodies = JSON.stringify(translated);
            } catch {}
          }
        }
      }'''

new_getmsg = '''      // Auto-translate if preferred language is not English
      if (input.lang && input.lang !== "en") {
        const targetLangName = input.lang === "es" ? "Spanish" : "Catalan";
        for (const msg of messages) {
          if (!msg.body) continue;
          let translated: Record<string, string> = {};
          if (msg.translatedBodies) {
            try { translated = JSON.parse(msg.translatedBodies); } catch {}
          }
          if (!translated[input.lang]) {
            try {
              // Only translate if the message is not already in the target language
              const shouldTranslate = await needsTranslation(msg.body, input.lang);
              if (!shouldTranslate) {
                // Message is already in the target language — cache as-is to avoid future LLM calls
                translated[input.lang] = msg.body;
                await db
                  .update(forumMessages)
                  .set({ translatedBodies: JSON.stringify(translated) })
                  .where(eq(forumMessages.id, msg.id));
                msg.translatedBodies = JSON.stringify(translated);
              } else {
                const res = await invokeLLM({
                  messages: [
                    {
                      role: "system",
                      content: `You are a professional translator. Translate the following message into ${targetLangName}. Return ONLY the translated text — no explanations, no quotes, no extra text.`,
                    },
                    { role: "user", content: msg.body },
                  ],
                });
                const llmContent = res.choices?.[0]?.message?.content;
                const translatedText = typeof llmContent === "string" ? llmContent.trim() : msg.body;
                translated[input.lang] = translatedText;
                await db
                  .update(forumMessages)
                  .set({ translatedBodies: JSON.stringify(translated) })
                  .where(eq(forumMessages.id, msg.id));
                msg.translatedBodies = JSON.stringify(translated);
              }
            } catch {}
          }
        }
      }'''

if old_getmsg in content:
    content = content.replace(old_getmsg, new_getmsg, 1)
    print("✓ Fixed getMessages translation block")
else:
    print("✗ Could not find getMessages translation block — check whitespace")

# ── 3. Fix getDirectMessages translation block ──
old_getdm = '''      // Auto-translate if preferred language is not English
      if (input.lang && input.lang !== "en") {
        for (const msg of messages) {
          if (!msg.body) continue;
          let translated: Record<string, string> = {};
          if (msg.translatedBodies) {
            try { translated = JSON.parse(msg.translatedBodies); } catch {}
          }
          if (!translated[input.lang]) {
            try {
              const langName = input.lang === "es" ? "Spanish" : "Catalan";
              const res = await invokeLLM({
                messages: [
                  { role: "system", content: `Translate the following message to ${langName}. Return only the translated text, nothing else.` },
                  { role: "user", content: msg.body },
                ],
              });
              const translatedText = typeof content === "string" ? content.trim() : msg.body;
              translated[input.lang] = translatedText;
              await db
                .update(forumDirectMessages)
                .set({ translatedBodies: JSON.stringify(translated) })
                .where(eq(forumDirectMessages.id, msg.id));
              msg.translatedBodies = JSON.stringify(translated);
            } catch {}
          }
        }
      }'''

new_getdm = '''      // Auto-translate if preferred language is not English
      if (input.lang && input.lang !== "en") {
        const targetLangName = input.lang === "es" ? "Spanish" : "Catalan";
        for (const msg of messages) {
          if (!msg.body) continue;
          let translated: Record<string, string> = {};
          if (msg.translatedBodies) {
            try { translated = JSON.parse(msg.translatedBodies); } catch {}
          }
          if (!translated[input.lang]) {
            try {
              const shouldTranslate = await needsTranslation(msg.body, input.lang);
              if (!shouldTranslate) {
                translated[input.lang] = msg.body;
                await db
                  .update(forumDirectMessages)
                  .set({ translatedBodies: JSON.stringify(translated) })
                  .where(eq(forumDirectMessages.id, msg.id));
                msg.translatedBodies = JSON.stringify(translated);
              } else {
                const res = await invokeLLM({
                  messages: [
                    { role: "system", content: `You are a professional translator. Translate the following message into ${targetLangName}. Return ONLY the translated text — no explanations, no quotes, no extra text.` },
                    { role: "user", content: msg.body },
                  ],
                });
                const llmContent = res.choices?.[0]?.message?.content;
                const translatedText = typeof llmContent === "string" ? llmContent.trim() : msg.body;
                translated[input.lang] = translatedText;
                await db
                  .update(forumDirectMessages)
                  .set({ translatedBodies: JSON.stringify(translated) })
                  .where(eq(forumDirectMessages.id, msg.id));
                msg.translatedBodies = JSON.stringify(translated);
              }
            } catch {}
          }
        }
      }'''

if old_getdm in content:
    content = content.replace(old_getdm, new_getdm, 1)
    print("✓ Fixed getDirectMessages translation block")
else:
    # Try to find it with different whitespace
    import re
    dm_match = re.search(r'// Auto-translate if preferred language is not English\s+if \(input\.lang && input\.lang !== "en"\) \{\s+for \(const msg of messages\)', content)
    if dm_match:
        print(f"Found DM block at position {dm_match.start()} — manual inspection needed")
    else:
        print("✗ Could not find getDirectMessages translation block")

# ── 4. Fix getThreadReplies translation block ──
old_thread = '''      // Auto-translate if needed
      if (input.lang && input.lang !== "en") {
        for (const r of replies) {
          let translated: Record<string, string> = {};
          if (r.translatedBodies) { try { translated = JSON.parse(r.translatedBodies); } catch {} }
          if (!translated[input.lang]) {
            try {
              const res = await invokeLLM({
                messages: [
                  { role: "system", content: `Translate to ${input.lang === "es" ? "Spanish" : "Catalan"}. Return only the translation.` },
                  { role: "user", content: r.body },
                ],
              });
              const translatedText = typeof content === "string" ? content.trim() : r.body;
              translated[input.lang] = translatedText;
              await db
                .update(forumThreadReplies)
                .set({ translatedBodies: JSON.stringify(translated) })
                .where(eq(forumThreadReplies.id, r.id));
              r.translatedBodies = JSON.stringify(translated);
            } catch {}
          }
        }
      }'''

new_thread = '''      // Auto-translate if needed
      if (input.lang && input.lang !== "en") {
        const targetLangName = input.lang === "es" ? "Spanish" : "Catalan";
        for (const r of replies) {
          let translated: Record<string, string> = {};
          if (r.translatedBodies) { try { translated = JSON.parse(r.translatedBodies); } catch {} }
          if (!translated[input.lang]) {
            try {
              const shouldTranslate = await needsTranslation(r.body, input.lang);
              if (!shouldTranslate) {
                translated[input.lang] = r.body;
                await db
                  .update(forumThreadReplies)
                  .set({ translatedBodies: JSON.stringify(translated) })
                  .where(eq(forumThreadReplies.id, r.id));
                r.translatedBodies = JSON.stringify(translated);
              } else {
                const res = await invokeLLM({
                  messages: [
                    { role: "system", content: `You are a professional translator. Translate the following message into ${targetLangName}. Return ONLY the translated text — no explanations, no quotes, no extra text.` },
                    { role: "user", content: r.body },
                  ],
                });
                const llmContent = res.choices?.[0]?.message?.content;
                const translatedText = typeof llmContent === "string" ? llmContent.trim() : r.body;
                translated[input.lang] = translatedText;
                await db
                  .update(forumThreadReplies)
                  .set({ translatedBodies: JSON.stringify(translated) })
                  .where(eq(forumThreadReplies.id, r.id));
                r.translatedBodies = JSON.stringify(translated);
              }
            } catch {}
          }
        }
      }'''

if old_thread in content:
    content = content.replace(old_thread, new_thread, 1)
    print("✓ Fixed getThreadReplies translation block")
else:
    print("✗ Could not find getThreadReplies translation block — check whitespace")

with open(path, "w") as f:
    f.write(content)

print("Done.")
