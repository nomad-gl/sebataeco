"""
Fix the DM and thread reply translation blocks in forum.ts.
Uses line-based replacement to avoid whitespace mismatch issues.
"""

path = "/home/ubuntu/seba-ai-studio/server/routers/forum.ts"

with open(path) as f:
    lines = f.readlines()

# ── Find and replace the DM translation block (lines ~327-356) ──
# Look for the block starting with "              const langName = input.lang ==="
# and ending before "        return rows.map"

dm_start = None
dm_end = None
for i, line in enumerate(lines):
    if 'const langName = input.lang === "es" ? "Spanish" : "Catalan";' in line and dm_start is None:
        # Walk back to find the "if (!translated[input.lang])" line
        for j in range(i, max(i-5, 0), -1):
            if 'if (!translated[input.lang])' in lines[j]:
                dm_start = j
                break
        # Walk forward to find the closing "}" of the try/catch block
        depth = 0
        for j in range(i, min(i+30, len(lines))):
            if '{' in lines[j]:
                depth += lines[j].count('{')
            if '}' in lines[j]:
                depth -= lines[j].count('}')
            if depth <= 0 and j > i:
                dm_end = j + 1
                break
        break

if dm_start is not None and dm_end is not None:
    print(f"Found DM translation block: lines {dm_start+1}-{dm_end}")
    # Build replacement
    indent = "          "  # 10 spaces
    new_dm_block = [
        f"{indent}if (!translated[input.lang]) {{\n",
        f"{indent}  try {{\n",
        f"{indent}    const targetLangName = input.lang === \"es\" ? \"Spanish\" : \"Catalan\";\n",
        f"{indent}    const shouldTranslate = await needsTranslation(msg.body, input.lang);\n",
        f"{indent}    if (!shouldTranslate) {{\n",
        f"{indent}      translated[input.lang] = msg.body;\n",
        f"{indent}      await db\n",
        f"{indent}        .update(forumDirectMessages)\n",
        f"{indent}        .set({{ translatedBodies: JSON.stringify(translated) }})\n",
        f"{indent}        .where(eq(forumDirectMessages.id, msg.id));\n",
        f"{indent}      msg.translatedBodies = JSON.stringify(translated);\n",
        f"{indent}    }} else {{\n",
        f"{indent}      const res = await invokeLLM({{\n",
        f"{indent}        messages: [\n",
        f"{indent}          {{ role: \"system\", content: `You are a professional translator. Translate the following message into ${{targetLangName}}. Return ONLY the translated text — no explanations, no quotes, no extra text.` }},\n",
        f"{indent}          {{ role: \"user\", content: msg.body }},\n",
        f"{indent}        ],\n",
        f"{indent}      }});\n",
        f"{indent}      const llmContent = res?.choices?.[0]?.message?.content;\n",
        f"{indent}      const translatedText = typeof llmContent === \"string\" ? llmContent.trim() : msg.body;\n",
        f"{indent}      translated[input.lang] = translatedText;\n",
        f"{indent}      await db\n",
        f"{indent}        .update(forumDirectMessages)\n",
        f"{indent}        .set({{ translatedBodies: JSON.stringify(translated) }})\n",
        f"{indent}        .where(eq(forumDirectMessages.id, msg.id));\n",
        f"{indent}      msg.translatedBodies = JSON.stringify(translated);\n",
        f"{indent}    }}\n",
        f"{indent}  }} catch {{\n",
        f"{indent}    // fall back to original on error\n",
        f"{indent}  }}\n",
        f"{indent}}}\n",
    ]
    lines[dm_start:dm_end] = new_dm_block
    print("✓ Fixed DM translation block")
else:
    print(f"✗ Could not find DM translation block (dm_start={dm_start}, dm_end={dm_end})")

# Re-read to get updated line numbers
with open(path, "w") as f:
    f.writelines(lines)

with open(path) as f:
    lines = f.readlines()

# ── Find and replace the thread reply translation block ──
thread_start = None
thread_end = None
for i, line in enumerate(lines):
    if '`Translate to ${input.lang === "es" ? "Spanish" : "Catalan"}. Return only the translation.`' in line:
        for j in range(i, max(i-5, 0), -1):
            if 'if (!translated[input.lang])' in lines[j]:
                thread_start = j
                break
        depth = 0
        for j in range(i, min(i+25, len(lines))):
            if '{' in lines[j]:
                depth += lines[j].count('{')
            if '}' in lines[j]:
                depth -= lines[j].count('}')
            if depth <= 0 and j > i:
                thread_end = j + 1
                break
        break

if thread_start is not None and thread_end is not None:
    print(f"Found thread translation block: lines {thread_start+1}-{thread_end}")
    indent = "          "  # 10 spaces
    new_thread_block = [
        f"{indent}if (!translated[input.lang]) {{\n",
        f"{indent}  try {{\n",
        f"{indent}    const targetLangName = input.lang === \"es\" ? \"Spanish\" : \"Catalan\";\n",
        f"{indent}    const shouldTranslate = await needsTranslation(r.body, input.lang);\n",
        f"{indent}    if (!shouldTranslate) {{\n",
        f"{indent}      translated[input.lang] = r.body;\n",
        f"{indent}      await db.update(forumThreadReplies)\n",
        f"{indent}        .set({{ translatedBodies: JSON.stringify(translated) }})\n",
        f"{indent}        .where(eq(forumThreadReplies.id, r.id));\n",
        f"{indent}      r.translatedBodies = JSON.stringify(translated);\n",
        f"{indent}    }} else {{\n",
        f"{indent}      const res = await invokeLLM({{\n",
        f"{indent}        messages: [\n",
        f"{indent}          {{ role: \"system\", content: `You are a professional translator. Translate the following message into ${{targetLangName}}. Return ONLY the translated text — no explanations, no quotes, no extra text.` }},\n",
        f"{indent}          {{ role: \"user\", content: r.body }},\n",
        f"{indent}        ],\n",
        f"{indent}      }});\n",
        f"{indent}      const llmContent = res?.choices?.[0]?.message?.content;\n",
        f"{indent}      const translatedText = typeof llmContent === \"string\" ? llmContent.trim() : r.body;\n",
        f"{indent}      translated[input.lang] = translatedText;\n",
        f"{indent}      await db.update(forumThreadReplies)\n",
        f"{indent}        .set({{ translatedBodies: JSON.stringify(translated) }})\n",
        f"{indent}        .where(eq(forumThreadReplies.id, r.id));\n",
        f"{indent}      r.translatedBodies = JSON.stringify(translated);\n",
        f"{indent}    }}\n",
        f"{indent}  }} catch {{}}\n",
        f"{indent}}}\n",
    ]
    lines[thread_start:thread_end] = new_thread_block
    print("✓ Fixed thread reply translation block")
else:
    print(f"✗ Could not find thread reply translation block (thread_start={thread_start}, thread_end={thread_end})")

with open(path, "w") as f:
    f.writelines(lines)

print("Done.")
