import re

with open('/home/ubuntu/seba-ai-studio/client/src/contexts/I18nContext.tsx') as f:
    lines = f.readlines()

# Print the exact keys at the flagged lines
flagged = [2166, 2168, 2169, 2177, 2180, 2182, 2188, 2189, 2190, 2191,
           4347, 4349, 4350, 4358, 4361, 4363, 4369, 4370, 4371, 4372,
           6525, 6527, 6528, 6536, 6539, 6541, 6547, 6548, 6549, 6550]

print("Keys at flagged lines:")
for ln in flagged:
    line = lines[ln-1]
    m = re.match(r'\s+(\w+):', line)
    key = m.group(1) if m else "(no match)"
    print(f"  Line {ln}: {key!r:30s} | {line.rstrip()}")

# Now find ALL occurrences of these keys in the file
keys_to_find = set()
for ln in flagged:
    line = lines[ln-1]
    m = re.match(r'\s+(\w+):', line)
    if m:
        keys_to_find.add(m.group(1))

print(f"\nSearching for all occurrences of {len(keys_to_find)} keys:")
for key in sorted(keys_to_find):
    occurrences = []
    for i, line in enumerate(lines, start=1):
        m = re.match(r'\s+' + re.escape(key) + r':', line)
        if m:
            occurrences.append(i)
    print(f"  {key!r}: lines {occurrences}")
