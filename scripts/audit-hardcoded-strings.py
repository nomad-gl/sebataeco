#!/usr/bin/env python3
"""
Hardcoded String Audit for SEBA AI Studio
==========================================
Scans all .tsx/.ts files in client/src for JSX text content and
string attributes that are NOT wrapped in t() translation calls.

Outputs a report to stdout and writes a JSON results file.
Exit code 0 = no issues found, 1 = issues found.
"""

import re
import os
import sys
import json
import datetime

# ── Configuration ─────────────────────────────────────────────────────────────
SCAN_ROOT = os.path.join(os.path.dirname(__file__), "..", "client", "src")
RESULTS_FILE = os.path.join(os.path.dirname(__file__), "..", "i18n-audit-results.json")
SKIP_DIRS = {"node_modules", ".git", "dist", "build", "_core"}
SKIP_FILES = {
    # These files intentionally contain multilingual raw strings
    "I18nContext.tsx",
    "CatalanDialectDetector.tsx",
}

# Minimum string length to flag (avoid flagging very short strings)
MIN_LENGTH = 8

# Patterns that indicate a line is already translated or is not user-facing
SAFE_PATTERNS = [
    r"t\(",                  # already using t()
    r"^\s*//",               # comment
    r"^\s*\*",               # JSDoc comment
    r"console\.",            # console.log etc.
    r"className=",           # CSS class names
    r"href=",                # URLs
    r"src=",                 # image src
    r"key=",                 # React keys
    r"id=",                  # HTML ids
    r"type=",                # input types
    r"variant=",             # component variants
    r"role=",                # ARIA roles
    r"itemProp=",            # schema.org
    r"itemType=",            # schema.org
    r"itemScope",            # schema.org
    r"aria-label=\{",        # dynamic aria-label
    r"data-",                # data attributes
    r"import ",              # import statements
    r"export ",              # export statements
    r"const ",               # const declarations (non-JSX)
    r"interface ",           # TypeScript interfaces
    r"type ",                # TypeScript types
    r"enum ",                # TypeScript enums
    r"throw new",            # error throws
    r"\.env\.",              # env vars
    r"process\.",            # process.env
    r"window\.",             # window object
    r"document\.",           # document object
    r"localStorage",         # storage
    r"sessionStorage",       # storage
    r"navigator\.",          # navigator
    r"new Date",             # dates
    r"Math\.",               # math
    r"JSON\.",               # JSON
    r"\.toString",           # toString
    r"\.toFixed",            # number formatting
    r"\.toLocale",           # locale formatting
    r"@/",                   # import paths
    r"https?://",            # URLs
    r"mailto:",              # email links
    r"tel:",                 # phone links
    r"\.cat\b",              # email domains
    r"\.com\b",              # domains
    r"\.es\b",               # domains
    r"\.forum\b",            # domains
    r"pnpm\b",               # package manager
    r"npm\b",                # package manager
    r"bcrypt",               # crypto
    r"crypto\.",             # crypto
    r"z\.",                  # zod schema
    r"trpc\.",               # trpc calls
    r"db\.",                 # db calls
    r"eq\(",                 # drizzle
    r"and\(",                # drizzle
    r"or\(",                 # drizzle
    r"sql`",                 # raw sql
    r"\.map\(",              # array map
    r"\.filter\(",           # array filter
    r"\.find\(",             # array find
    r"\.reduce\(",           # array reduce
    r"\.sort\(",             # array sort
    r"\.join\(",             # array join
    r"\.split\(",            # string split
    r"\.replace\(",          # string replace
    r"\.trim\(",             # string trim
    r"\.toLowerCase",        # string methods
    r"\.toUpperCase",        # string methods
    r"\.includes\(",         # string includes
    r"\.startsWith\(",       # string startsWith
    r"\.endsWith\(",         # string endsWith
    r"\.slice\(",            # string slice
    r"\.substring\(",        # string substring
    r"\.indexOf\(",          # string indexOf
    r"\.padStart\(",         # string padding
    r"\.padEnd\(",           # string padding
    r"\.length",             # length property
    r"typeof ",              # typeof
    r"instanceof ",          # instanceof
    r"undefined",            # undefined
    r"null",                 # null
    r"true",                 # boolean
    r"false",                # boolean
    r"NaN",                  # NaN
    r"Infinity",             # Infinity
    r"Promise\.",            # Promise
    r"async ",               # async functions
    r"await ",               # await
    r"return ",              # return statements
    r"if \(",                # conditionals
    r"else ",                # else
    r"for \(",               # loops
    r"while \(",             # loops
    r"switch \(",            # switch
    r"case ",                # case
    r"break",                # break
    r"continue",             # continue
    r"try {",                # try/catch
    r"catch \(",             # try/catch
    r"finally {",            # try/catch
    r"\.catch\(",            # promise catch
    r"\.then\(",             # promise then
    r"\.finally\(",          # promise finally
    r"setTimeout",           # timer
    r"setInterval",          # timer
    r"clearTimeout",         # timer
    r"clearInterval",        # timer
    r"requestAnimationFrame",# RAF
    r"cancelAnimationFrame", # RAF
    r"addEventListener",     # event listener
    r"removeEventListener",  # event listener
    r"dispatchEvent",        # event dispatch
    r"CustomEvent",          # custom event
    r"new Error",            # error creation
    r"Error\(",              # error creation
    r"\.message",            # error message
    r"\.stack",              # error stack
    r"\.name",               # error name
    r"\.code",               # error code
    r"\.status",             # status code
    r"\.data",               # data property
    r"\.result",             # result property
    r"\.value",              # value property
    r"\.checked",            # checkbox
    r"\.target",             # event target
    r"\.currentTarget",      # event target
    r"\.preventDefault",     # event method
    r"\.stopPropagation",    # event method
    r"\.nativeEvent",        # React event
    r"React\.",              # React
    r"useState",             # React hooks
    r"useEffect",            # React hooks
    r"useCallback",          # React hooks
    r"useMemo",              # React hooks
    r"useRef",               # React hooks
    r"useContext",           # React hooks
    r"useReducer",           # React hooks
    r"createContext",        # React context
    r"forwardRef",           # React forwardRef
    r"memo\(",               # React memo
    r"Fragment",             # React Fragment
    r"children",             # React children
    r"className",            # JSX className
    r"style=",               # inline styles
    r"onClick=",             # event handlers
    r"onChange=",            # event handlers
    r"onSubmit=",            # event handlers
    r"onBlur=",              # event handlers
    r"onFocus=",             # event handlers
    r"onKeyDown=",           # event handlers
    r"onKeyUp=",             # event handlers
    r"onMouseEnter=",        # event handlers
    r"onMouseLeave=",        # event handlers
    r"disabled=",            # disabled prop
    r"required=",            # required prop
    r"readOnly=",            # readOnly prop
    r"autoFocus=",           # autoFocus prop
    r"autoComplete=",        # autoComplete prop
    r"maxLength=",           # maxLength prop
    r"minLength=",           # minLength prop
    r"min=",                 # min prop
    r"max=",                 # max prop
    r"step=",                # step prop
    r"rows=",                # rows prop
    r"cols=",                # cols prop
    r"size=",                # size prop
    r"width=",               # width prop
    r"height=",              # height prop
    r"tabIndex=",            # tabIndex prop
    r"htmlFor=",             # htmlFor prop
    r"defaultValue=",        # defaultValue prop
    r"defaultChecked=",      # defaultChecked prop
    r"value=\{",             # dynamic value
    r"checked=\{",           # dynamic checked
    r"name=",                # name prop
    r"form=",                # form prop
    r"method=",              # form method
    r"action=",              # form action
    r"encType=",             # form encType
    r"target=",              # link target
    r"rel=",                 # link rel
    r"lang=",                # lang attribute
    r"dir=",                 # dir attribute
    r"hidden=",              # hidden prop
    r"open=",                # open prop
    r"async=",               # async prop
    r"defer=",               # defer prop
    r"crossOrigin=",         # crossOrigin prop
    r"referrerPolicy=",      # referrerPolicy prop
    r"loading=",             # loading prop
    r"decoding=",            # decoding prop
    r"fetchPriority=",       # fetchPriority prop
    r"as=",                  # as prop
    r"preload=",             # preload prop
    r"controls=",            # controls prop
    r"loop=",                # loop prop
    r"muted=",               # muted prop
    r"autoPlay=",            # autoPlay prop
    r"playsInline=",         # playsInline prop
    r"poster=",              # poster prop
    r"kind=",                # track kind
    r"srclang=",             # track srclang
    r"default=",             # track default
    r"label=\{",             # dynamic label
    r"placeholder=\{",       # dynamic placeholder
    r"title=\{",             # dynamic title
    r"aria-",                # ARIA attributes
    r"data-",                # data attributes
    r"itemProp",             # schema.org
    r"itemType",             # schema.org
    r"itemScope",            # schema.org
    r"itemID",               # schema.org
    r"itemRef",              # schema.org
    r"vocab=",               # RDFa
    r"typeof=",              # RDFa
    r"property=",            # RDFa/OG
    r"content=",             # meta content
    r"charset=",             # meta charset
    r"httpEquiv=",           # meta http-equiv
    r"viewport",             # meta viewport
    r"robots",               # meta robots
    r"description",          # meta description (attribute)
    r"keywords",             # meta keywords
    r"author",               # meta author
    r"generator",            # meta generator
    r"theme-color",          # meta theme-color
    r"og:",                  # Open Graph
    r"twitter:",             # Twitter cards
    r"fb:",                  # Facebook
    r"schema\.org",          # schema.org
    r"application/",         # MIME types
    r"text/",                # MIME types
    r"image/",               # MIME types
    r"video/",               # MIME types
    r"audio/",               # MIME types
    r"font/",                # MIME types
    r"multipart/",           # MIME types
    r"px\b",                 # CSS units
    r"rem\b",                # CSS units
    r"em\b",                 # CSS units
    r"vh\b",                 # CSS units
    r"vw\b",                 # CSS units
    r"%\b",                  # CSS units
    r"#[0-9a-fA-F]{3,6}",   # CSS colors
    r"rgb\(",                # CSS colors
    r"rgba\(",               # CSS colors
    r"hsl\(",                # CSS colors
    r"oklch\(",              # CSS colors
    r"linear-gradient",      # CSS gradients
    r"radial-gradient",      # CSS gradients
    r"conic-gradient",       # CSS gradients
    r"var\(--",              # CSS variables
    r"calc\(",               # CSS calc
    r"clamp\(",              # CSS clamp
    r"min\(",                # CSS min
    r"max\(",                # CSS max
    r"translate\(",          # CSS transform
    r"rotate\(",             # CSS transform
    r"scale\(",              # CSS transform
    r"skew\(",               # CSS transform
    r"matrix\(",             # CSS transform
    r"perspective\(",        # CSS transform
    r"blur\(",               # CSS filter
    r"brightness\(",         # CSS filter
    r"contrast\(",           # CSS filter
    r"grayscale\(",          # CSS filter
    r"hue-rotate\(",         # CSS filter
    r"invert\(",             # CSS filter
    r"opacity\(",            # CSS filter
    r"saturate\(",           # CSS filter
    r"sepia\(",              # CSS filter
    r"drop-shadow\(",        # CSS filter
    r"polygon\(",            # CSS clip-path
    r"circle\(",             # CSS clip-path
    r"ellipse\(",            # CSS clip-path
    r"inset\(",              # CSS clip-path
    r"path\(",               # CSS clip-path/SVG
    r"cubic-bezier\(",       # CSS timing
    r"steps\(",              # CSS timing
    r"ease\b",               # CSS timing
    r"linear\b",             # CSS timing
    r"infinite\b",           # CSS animation
    r"forwards\b",           # CSS animation
    r"backwards\b",          # CSS animation
    r"both\b",               # CSS animation
    r"none\b",               # CSS value
    r"auto\b",               # CSS value
    r"inherit\b",            # CSS value
    r"initial\b",            # CSS value
    r"unset\b",              # CSS value
    r"revert\b",             # CSS value
    r"normal\b",             # CSS value
    r"bold\b",               # CSS font-weight
    r"italic\b",             # CSS font-style
    r"underline\b",          # CSS text-decoration
    r"line-through\b",       # CSS text-decoration
    r"uppercase\b",          # CSS text-transform
    r"lowercase\b",          # CSS text-transform
    r"capitalize\b",         # CSS text-transform
    r"center\b",             # CSS text-align
    r"left\b",               # CSS text-align
    r"right\b",              # CSS text-align
    r"justify\b",            # CSS text-align
    r"flex\b",               # CSS display
    r"grid\b",               # CSS display
    r"block\b",              # CSS display
    r"inline\b",             # CSS display
    r"hidden\b",             # CSS display
    r"visible\b",            # CSS visibility
    r"absolute\b",           # CSS position
    r"relative\b",           # CSS position
    r"fixed\b",              # CSS position
    r"sticky\b",             # CSS position
    r"static\b",             # CSS position
    r"overflow\b",           # CSS overflow
    r"scroll\b",             # CSS overflow
    r"clip\b",               # CSS overflow
    r"pointer\b",            # CSS cursor
    r"default\b",            # CSS cursor
    r"not-allowed\b",        # CSS cursor
    r"grab\b",               # CSS cursor
    r"grabbing\b",           # CSS cursor
    r"crosshair\b",          # CSS cursor
    r"text\b",               # CSS cursor
    r"move\b",               # CSS cursor
    r"resize\b",             # CSS cursor
    r"zoom-in\b",            # CSS cursor
    r"zoom-out\b",           # CSS cursor
    r"col-span",             # Tailwind
    r"row-span",             # Tailwind
    r"aspect-",              # Tailwind
    r"object-",              # Tailwind
    r"truncate",             # Tailwind
    r"whitespace-",          # Tailwind
    r"break-",               # Tailwind
    r"leading-",             # Tailwind
    r"tracking-",            # Tailwind
    r"font-",                # Tailwind
    r"text-",                # Tailwind
    r"bg-",                  # Tailwind
    r"border-",              # Tailwind
    r"rounded-",             # Tailwind
    r"shadow-",              # Tailwind
    r"opacity-",             # Tailwind
    r"transition-",          # Tailwind
    r"duration-",            # Tailwind
    r"ease-",                # Tailwind
    r"delay-",               # Tailwind
    r"animate-",             # Tailwind
    r"transform",            # Tailwind
    r"scale-",               # Tailwind
    r"rotate-",              # Tailwind
    r"translate-",           # Tailwind
    r"skew-",                # Tailwind
    r"origin-",              # Tailwind
    r"cursor-",              # Tailwind
    r"select-",              # Tailwind
    r"resize-",              # Tailwind
    r"appearance-",          # Tailwind
    r"outline-",             # Tailwind
    r"ring-",                # Tailwind
    r"divide-",              # Tailwind
    r"space-",               # Tailwind
    r"gap-",                 # Tailwind
    r"p-",                   # Tailwind padding
    r"m-",                   # Tailwind margin
    r"w-",                   # Tailwind width
    r"h-",                   # Tailwind height
    r"min-",                 # Tailwind min
    r"max-",                 # Tailwind max
    r"flex-",                # Tailwind flex
    r"grid-",                # Tailwind grid
    r"col-",                 # Tailwind grid
    r"row-",                 # Tailwind grid
    r"place-",               # Tailwind place
    r"items-",               # Tailwind items
    r"justify-",             # Tailwind justify
    r"self-",                # Tailwind self
    r"content-",             # Tailwind content
    r"order-",               # Tailwind order
    r"z-",                   # Tailwind z-index
    r"overflow-",            # Tailwind overflow
    r"overscroll-",          # Tailwind overscroll
    r"position-",            # Tailwind position
    r"inset-",               # Tailwind inset
    r"top-",                 # Tailwind top
    r"right-",               # Tailwind right
    r"bottom-",              # Tailwind bottom
    r"left-",                # Tailwind left
    r"float-",               # Tailwind float
    r"clear-",               # Tailwind clear
    r"visibility-",          # Tailwind visibility
    r"pointer-",             # Tailwind pointer
    r"sr-only",              # Tailwind screen reader
    r"not-sr-only",          # Tailwind screen reader
    r"list-",                # Tailwind list
    r"table-",               # Tailwind table
    r"caption-",             # Tailwind caption
    r"align-",               # Tailwind align
    r"vertical-",            # Tailwind vertical
    r"decoration-",          # Tailwind decoration
    r"underline-",           # Tailwind underline
    r"indent-",              # Tailwind indent
    r"line-clamp-",          # Tailwind line-clamp
    r"columns-",             # Tailwind columns
    r"break-",               # Tailwind break
    r"box-",                 # Tailwind box
    r"isolation-",           # Tailwind isolation
    r"mix-blend-",           # Tailwind mix-blend
    r"bg-blend-",            # Tailwind bg-blend
    r"filter-",              # Tailwind filter
    r"backdrop-",            # Tailwind backdrop
    r"will-change-",         # Tailwind will-change
    r"contain-",             # Tailwind contain
    r"forced-color-",        # Tailwind forced-color
    r"print:",               # Tailwind print
    r"dark:",                # Tailwind dark mode
    r"light:",               # Tailwind light mode
    r"hover:",               # Tailwind hover
    r"focus:",               # Tailwind focus
    r"active:",              # Tailwind active
    r"visited:",             # Tailwind visited
    r"disabled:",            # Tailwind disabled
    r"checked:",             # Tailwind checked
    r"indeterminate:",       # Tailwind indeterminate
    r"placeholder:",         # Tailwind placeholder
    r"before:",              # Tailwind before
    r"after:",               # Tailwind after
    r"first:",               # Tailwind first
    r"last:",                # Tailwind last
    r"odd:",                 # Tailwind odd
    r"even:",                # Tailwind even
    r"nth:",                 # Tailwind nth
    r"only:",                # Tailwind only
    r"empty:",               # Tailwind empty
    r"group-",               # Tailwind group
    r"peer-",                # Tailwind peer
    r"sm:",                  # Tailwind responsive
    r"md:",                  # Tailwind responsive
    r"lg:",                  # Tailwind responsive
    r"xl:",                  # Tailwind responsive
    r"2xl:",                 # Tailwind responsive
    r"3xl:",                 # Tailwind responsive
    r"4xl:",                 # Tailwind responsive
    r"5xl:",                 # Tailwind responsive
    r"6xl:",                 # Tailwind responsive
    r"7xl:",                 # Tailwind responsive
    r"8xl:",                 # Tailwind responsive
    r"9xl:",                 # Tailwind responsive
]

# Compile safe patterns
safe_re = [re.compile(p) for p in SAFE_PATTERNS]

# Pattern to find JSX text content: >text</
jsx_text_re = re.compile(r'>\s*([A-Z][^<{}\n]{6,}?)\s*</')

# Pattern to find hardcoded string props: placeholder="text", title="text", etc.
# but NOT when they use t(
prop_str_re = re.compile(r'(?:placeholder|title|aria-label|description)\s*=\s*"([A-Z][^"]{6,})"')

def is_safe_line(line: str) -> bool:
    """Return True if the line is safe to ignore (already translated or non-user-facing)."""
    stripped = line.strip()
    for r in safe_re:
        if r.search(stripped):
            return True
    return False

def scan_file(fpath: str) -> list[dict]:
    issues = []
    try:
        with open(fpath, encoding="utf-8") as f:
            lines = f.readlines()
    except Exception:
        return issues

    for i, line in enumerate(lines, 1):
        if is_safe_line(line):
            continue

        # Check for JSX text content
        for m in jsx_text_re.finditer(line):
            text = m.group(1).strip()
            if len(text) >= MIN_LENGTH and not text.startswith("{"):
                issues.append({
                    "file": fpath,
                    "line": i,
                    "type": "jsx_text",
                    "text": text[:120],
                    "raw_line": line.rstrip()[:150],
                })

        # Check for hardcoded string props
        for m in prop_str_re.finditer(line):
            text = m.group(1).strip()
            if len(text) >= MIN_LENGTH:
                issues.append({
                    "file": fpath,
                    "line": i,
                    "type": "prop_string",
                    "text": text[:120],
                    "raw_line": line.rstrip()[:150],
                })

    return issues


def main():
    scan_root = os.path.abspath(SCAN_ROOT)
    all_issues = []

    for root, dirs, files in os.walk(scan_root):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        for fname in sorted(files):
            if not (fname.endswith(".tsx") or fname.endswith(".ts")):
                continue
            if fname in SKIP_FILES:
                continue
            fpath = os.path.join(root, fname)
            rel = os.path.relpath(fpath, scan_root)
            issues = scan_file(fpath)
            for issue in issues:
                issue["file"] = rel
            all_issues.extend(issues)

    # Write results
    results = {
        "scanned_at": datetime.datetime.utcnow().isoformat() + "Z",
        "total_issues": len(all_issues),
        "issues": all_issues,
    }
    with open(RESULTS_FILE, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2, ensure_ascii=False)

    # Print summary
    if all_issues:
        print(f"[i18n-audit] {len(all_issues)} potential hardcoded strings found:")
        by_file: dict[str, list] = {}
        for issue in all_issues:
            by_file.setdefault(issue["file"], []).append(issue)
        for fpath, file_issues in sorted(by_file.items()):
            print(f"\n  {fpath} ({len(file_issues)} issues):")
            for issue in file_issues[:5]:
                print(f"    L{issue['line']} [{issue['type']}]: {issue['text'][:80]}")
            if len(file_issues) > 5:
                print(f"    ... and {len(file_issues) - 5} more")
        print(f"\nFull results written to: {RESULTS_FILE}")
        sys.exit(1)
    else:
        print("[i18n-audit] No hardcoded strings found. All user-facing text appears to use t().")
        sys.exit(0)


if __name__ == "__main__":
    main()
