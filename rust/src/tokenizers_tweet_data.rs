// Generated from pinned nltk.tokenize.casual; unsupported lookarounds handled by the scanner.
pub const PHONE: &str = r###"
    (?:
      (?:            # (international)
        \+?[01]
        [ *\-.\)]*
      )?
      (?:            # (area code)
        [\(]?
        \d{3}
        [ *\-.\)]*
      )?
      \d{3}          # exchange
      [ *\-.\)]*
      \d{4}          # base
    )"###;
pub const EMOTICON: &str = r###"
    (?:
      [<>]?
      [:;=8]                     # eyes
      [\-o\*\']?                 # optional nose
      [\)\]\(\[dDpP/\:\}\{@\|\\] # mouth
      |
      [\)\]\(\[dDpP/\:\}\{@\|\\] # mouth
      [\-o\*\']?                 # optional nose
      [:;=8]                     # eyes
      [<>]?
      |
      </?3                       # heart
    )"###;
pub const PATTERNS: &[&str] = &[
    r###"			# Capture 1: entire matched URL
  (?:
  https?:				# URL protocol and colon
    (?:
      /{1,3}				# 1-3 slashes
      |					#   or
      [a-z0-9%]				# Single letter or digit or '%'
                                       # (Trying not to match e.g. "URI::Escape")
    )
    |					#   or
                                       # looks like domain name followed by a slash:
    [a-z0-9.\-]{1,255}[.]              # bounded to avoid catastrophic backtracking (ReDoS)
    (?:[a-z]{2,13})
    /
  )
  (?:					# One or more:
    [^\s()<>{}\[\]]+			# Run of non-space, non-()<>{}[]
    |					#   or
    \([^\s()]{0,255}?\([^\s()]{1,255}\)[^\s()]{0,255}?\) # balanced parens, one level deep: (...(...)...)
    |
    \([^\s]{1,255}?\)				# balanced parens, non-recursive: (...)
  )+
  (?:					# End with:
    \([^\s()]{0,255}?\([^\s()]{1,255}\)[^\s()]{0,255}?\) # balanced parens, one level deep: (...(...)...)
    |
    \([^\s]{1,255}?\)				# balanced parens, non-recursive: (...)
    |					#   or
    [^\s`!()\[\]{};:'".,<>?«»“”‘’]	# not a space or one of these punct chars
  )
  |					# OR, the following to match naked domains:
  (?:
  	(?<!@)			        # not preceded by a @, avoid matching foo@_gmail.com_
    [a-z0-9]+
    (?:[.\-][a-z0-9]+){0,126}  # bounded to avoid catastrophic backtracking (ReDoS); DNS allows at most 127 labels
    [.]
    (?:[a-z]{2,13})
    \b
    /?
    (?!@)			        # not succeeded by a @,
                            # avoid matching "foo.na" in "foo.na@example.com"
  )
"###,
    r###"
    (?:
      [<>]?
      [:;=8]                     # eyes
      [\-o\*\']?                 # optional nose
      [\)\]\(\[dDpP/\:\}\{@\|\\] # mouth
      |
      [\)\]\(\[dDpP/\:\}\{@\|\\] # mouth
      [\-o\*\']?                 # optional nose
      [:;=8]                     # eyes
      [<>]?
      |
      </?3                       # heart
    )"###,
    r###"<[^>\s]+>"###,
    r###"[\-]+>|<[\-]+"###,
    r###"(?:@[\w_]+)"###,
    r###"(?:\#+[\w_]+[\w\'_\-]*[\w_]+)"###,
    r###"[\w.+-]{1,64}@[\w-]{1,63}\.(?:[\w-]\.?){1,251}[\w-]"###,
    r###".(?:
        [🏻-🏿]?(?:‍.[🏻-🏿]?)+
        |
        [🏻-🏿]
    )"###,
    r###"
  (?:
    [\U0001F1E6-\U0001F1FF]{2}  # all enclosed letter pairs
    |
    # English flag
    \U0001F3F4\U000E0067\U000E0062\U000E0065\U000E006e\U000E0067\U000E007F
    |
    # Scottish flag
    \U0001F3F4\U000E0067\U000E0062\U000E0073\U000E0063\U000E0074\U000E007F
    |
    # For Wales? Why Richard, it profit a man nothing to give his soul for the whole world … but for Wales!
    \U0001F3F4\U000E0067\U000E0062\U000E0077\U000E006C\U000E0073\U000E007F
  )
"###,
    r###"
    (?:[^\W\d_](?:[^\W\d_]|['\-_])+[^\W\d_]) # Words with apostrophes or dashes.
    |
    (?:[+\-]?\d+[,/.:-]\d+[+\-]?)  # Numbers, including fractions, decimals.
    |
    (?:[\w_]+)                     # Words without apostrophes or dashes.
    |
    (?:\.(?:\s*\.){1,})            # Ellipsis dots.
    |
    (?:\S)                         # Everything else that isn't whitespace.
    "###,
];
