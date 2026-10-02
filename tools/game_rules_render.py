"""Python port of game-rules.html's renderBlock()/card()/hand()/text() --
must stay class-for-class and tag-for-tag identical to the JS version so
css/style.css styles the static build exactly like the old JS-rendered page.
"""
import html
import re

SUIT = {"s": "♠", "h": "♥", "d": "♦", "c": "♣"}
PLACEHOLDER_RE = re.compile(r"%(?:\d+\$)?[sd]")

# small inline jester-face glyph (purple hat w/ gold bells, cream face)
# standing in for a plain "JOKER" text label -- kept identical to the
# JOKER_SVG string in game-rules.html's inline script.
JOKER_SVG = (
    '<svg viewBox="0 0 32 32" aria-hidden="true">'
    '<path d="M6 14 L10 4 L13 11 L16 2 L19 11 L22 4 L26 14 Z" fill="#8b5cf6"/>'
    '<circle cx="10" cy="4" r="1.6" fill="#f2d879"/>'
    '<circle cx="16" cy="2" r="1.6" fill="#f2d879"/>'
    '<circle cx="22" cy="4" r="1.6" fill="#f2d879"/>'
    '<path d="M7 14 q9 10 18 0 l-1.5 6 q-7.5 7-15 0 Z" fill="#faf6ea" stroke="#1a1a1a" stroke-width="0.8"/>'
    '<circle cx="12.5" cy="17.5" r="1.1" fill="#1a1a1a"/>'
    '<circle cx="19.5" cy="17.5" r="1.1" fill="#1a1a1a"/>'
    '<path d="M12.5 21.5 q3.5 2.5 7 0" fill="none" stroke="#1a1a1a" stroke-width="1" stroke-linecap="round"/>'
    '</svg>'
)


def esc(s):
    return html.escape(s, quote=True)


def esc_text(s):
    # text node content (not an attribute) -- matches JS's textContent
    # behavior, which never turns a literal '/" into an HTML entity.
    return html.escape(s, quote=False)


def card_html(code):
    if code == "_":
        return '<span class="gr-card gap"></span>'
    if code == "?":
        return '<span class="gr-card back"></span>'
    rank, suit = code[:-1], code[-1]
    if rank == "X":
        return '<span class="gr-card joker" data-suit="%s">%s</span>' % (esc(suit), JOKER_SVG)
    cls = "gr-card is-red" if suit in ("h", "d") else "gr-card"
    label = "10" if rank == "T" else rank
    return '<span class="%s">%s<span class="s">%s</span></span>' % (
        cls, esc(label), SUIT.get(suit, "")
    )


def hand_html(codes):
    """Split on the "_" placeholder into groups: 1 group -> plain flat hand
    (unchanged); 2 groups -> a "before -> after" demo, gold arrow between two
    bordered boxes; 3+ groups -> independent example hands side by side, each
    boxed, plain gap (no arrow) between them. Mirrors game-rules.html's JS
    hand() exactly.
    """
    groups = [[]]
    for c in (codes or []):
        if c == "_":
            groups.append([])
        else:
            groups[-1].append(c)
    groups = [g for g in groups if g] or [[]]

    if len(groups) == 1:
        inner = "".join(card_html(c) for c in groups[0])
        return '<div class="gr-hand">%s</div>' % inner

    parts = []
    for i, g in enumerate(groups):
        if i > 0:
            if len(groups) == 2:
                parts.append('<span class="gr-hand-arrow" aria-hidden="true">&#8594;</span>')
            else:
                parts.append('<span class="gr-hand-gap" aria-hidden="true"></span>')
        parts.append('<div class="gr-hand-group">%s</div>' % "".join(card_html(c) for c in g))
    return '<div class="gr-hand is-grouped">%s</div>' % "".join(parts)


def txt(node, lang):
    if node is None:
        return ""
    return node.get(lang) or node.get("en") or ""


def text_html(node, lang):
    """Escape then wrap %s/%d/%1$s placeholders in <span class="gr-ph">."""
    value = txt(node, lang)
    escaped = esc_text(value)
    out = []
    last = 0
    for m in PLACEHOLDER_RE.finditer(escaped):
        out.append(escaped[last:m.start()])
        out.append('<span class="gr-ph">%s</span>' % m.group(0))
        last = m.end()
    out.append(escaped[last:])
    return "".join(out)


def render_block(b, lang, game_rules):
    t = b["t"]
    if t == "h2":
        return '<div class="gr-sec-head"><h2>%s</h2></div>' % text_html(b["v"], lang)
    if t == "h3":
        return "<h3>%s</h3>" % text_html(b["v"], lang)
    if t == "sub":
        return '<p class="gr-sub">%s</p>' % text_html(b["v"], lang)
    if t == "p":
        return "<p>%s</p>" % text_html(b["v"], lang)
    if t == "hand":
        return hand_html(b["v"])
    if t == "steps":
        rows = []
        for s in b["v"]:
            bodies = "".join(
                '<p class="gr-step-body">%s</p>' % text_html(line, lang)
                for line in s["body"]
            )
            rows.append(
                '<div class="gr-step"><span class="gr-step-name">%s</span><div>%s</div></div>'
                % (text_html(s["name"], lang), bodies)
            )
        return '<div class="gr-steps">%s</div>' % "".join(rows)
    if t == "vrows":
        rows = []
        for r in b["v"]:
            rows.append(
                '<div class="gr-vrow">%s<span class="gr-amount">%s</span></div>'
                % (hand_html(r["cards"]), text_html(r["amount"], lang))
            )
        return '<div class="gr-vrows">%s</div>' % "".join(rows)
    if t == "paytable":
        rows = []
        for r in b["v"]:
            cards_html = hand_html(r["cards"]) if r.get("cards") else "<span></span>"
            rows.append(
                '<div class="gr-prow"><span class="gr-kind">%s</span>%s<span class="gr-amount">%s</span></div>'
                % (text_html(r["kind"], lang), cards_html, text_html(r["amount"], lang))
            )
        return '<div class="gr-vrows">%s</div>' % "".join(rows)
    if t == "ranking":
        cap = '<p class="gr-rank-cap">%s</p>' % text_html(game_rules["rankingCaption"], lang)
        trs = []
        for r in game_rules["ranking"]:
            trs.append(
                '<tr><th scope="row">%s</th><td>%s</td></tr>'
                % (text_html(r["name"], lang), hand_html(r["cards"]))
            )
        table = (
            '<div class="gr-table-scroll"><table class="gr-rank-table"><tbody>%s</tbody></table></div>'
            % "".join(trs)
        )
        return "<div>%s%s</div>" % (cap, table)
    return ""


def render_blocks(blocks, lang, game_rules):
    return "".join(render_block(b, lang, game_rules) for b in blocks)
