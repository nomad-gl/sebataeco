import re

with open('/home/ubuntu/seba-ai-studio/client/src/contexts/I18nContext.tsx') as f:
    lines = f.readlines()

total = len(lines)
print(f"Total lines: {total}")

# Find the language block boundaries
# Look for lines like "  en: {" and "  es: {" and "  ca: {"
block_starts = {}
for i, line in enumerate(lines, start=1):
    m = re.match(r'\s+(en|es|ca):\s*\{', line)
    if m:
        lang = m.group(1)
        block_starts[lang] = i
        print(f"Found '{lang}' block starting at line {i}")

# Determine block ranges
langs = sorted(block_starts.items(), key=lambda x: x[1])
ranges = {}
for idx, (lang, start) in enumerate(langs):
    end = langs[idx+1][1] - 1 if idx + 1 < len(langs) else total
    ranges[lang] = (start, end)
    print(f"  {lang}: lines {start}-{end}")

# Find duplicates in each block
for lang, (start, end) in ranges.items():
    block_lines = lines[start-1:end]
    seen = {}
    dups = []
    for i, line in enumerate(block_lines, start=start):
        m = re.match(r'\s+(\w+):', line)
        if m:
            key = m.group(1)
            if key in seen:
                dups.append((key, seen[key], i))
            else:
                seen[key] = i
    if dups:
        print(f"\nDuplicates in '{lang}' block:")
        for d in dups:
            print(f"  key='{d[0]}' first at line {d[1]}, duplicate at line {d[2]}")
    else:
        print(f"\nNo duplicates in '{lang}' block.")
