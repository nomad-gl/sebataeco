import re

with open('/home/ubuntu/seba-ai-studio/client/src/contexts/I18nContext.tsx') as f:
    content = f.read()
    lines = content.splitlines()

total = len(lines)

# Find language block boundaries more precisely
# Look for "  en: {" style lines
block_starts = {}
for i, line in enumerate(lines):
    m = re.match(r'^  (en|es|ca):\s*\{', line)
    if m:
        lang = m.group(1)
        block_starts[lang] = i + 1  # 1-indexed
        print(f"Found '{lang}' block at line {i+1}: {line!r}")

langs = sorted(block_starts.items(), key=lambda x: x[1])
ranges = {}
for idx, (lang, start) in enumerate(langs):
    end = langs[idx+1][1] - 1 if idx + 1 < len(langs) else total
    ranges[lang] = (start, end)

print(f"\nBlock ranges: {ranges}\n")

# For each language, find ALL keys and flag duplicates
for lang, (start, end) in ranges.items():
    block_lines = lines[start-1:end]
    seen = {}
    dups = []
    for i, line in enumerate(block_lines):
        abs_line = start + i
        m = re.match(r'^\s{4}(\w+):\s', line)  # exactly 4 spaces indent = top-level key
        if m:
            key = m.group(1)
            if key in seen:
                dups.append((key, seen[key], abs_line))
            else:
                seen[key] = abs_line
    if dups:
        print(f"Duplicates in '{lang}' block (lines {start}-{end}):")
        for d in dups:
            print(f"  key={d[0]!r} first at line {d[1]}, DUPLICATE at line {d[2]}")
            # Show context around the first occurrence
            first_line = lines[d[1]-1]
            dup_line = lines[d[2]-1]
            print(f"    First:     {first_line.rstrip()}")
            print(f"    Duplicate: {dup_line.rstrip()}")
    else:
        print(f"No duplicates in '{lang}' block.")
