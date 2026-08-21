"""Build the Sloppy Golf wordmark from official Cherry Bomb One outlines."""

from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools" / "python-packages"))

from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont


FONT_PATH = ROOT / "tools" / "CherryBombOne-Regular.ttf"
OUTPUT_PATH = ROOT / "sloppy-golf" / "media" / "branding" / "sloppy-golf-logo.svg"
SCALE = 0.16
BASELINE = 166
TRACKING_UNITS = -52
OUTLINE_WIDTH = 23
GREEN = "#97cc04"
BLUE = "#2d7dd2"


font = TTFont(FONT_PATH)
glyph_set = font.getGlyphSet()
cmap = font.getBestCmap()
metrics = font["hmtx"].metrics


def outline_text(text, start_x):
    paths = []
    cursor = start_x
    for character in text:
        glyph_name = cmap[ord(character)]
        pen = SVGPathPen(glyph_set)
        transformed = TransformPen(pen, (SCALE, 0, 0, -SCALE, cursor, BASELINE))
        glyph_set[glyph_name].draw(transformed)
        paths.append(pen.getCommands())
        cursor += (metrics[glyph_name][0] + TRACKING_UNITS) * SCALE
    return paths, cursor


sloppy_paths, sloppy_end = outline_text("SLOPPY", 30)
g_paths, g_end = outline_text("G", sloppy_end + 28)
ball_radius = 67
ball_center_x = g_end + 10 + ball_radius
lf_paths, word_end = outline_text("LF", ball_center_x + ball_radius + 10)
canvas_width = round(word_end + 30)
ball_center_y = 108

letter_paths = "\n    ".join(
    f'<path d="{commands}"/>' for commands in sloppy_paths + g_paths + lf_paths
)

dimple_offsets = [
    (-24, -48), (0, -48), (24, -48),
    (-42, -32), (-14, -32), (14, -32), (42, -32),
    (-48, -16), (-24, -16), (0, -16), (24, -16), (48, -16),
    (-48, 0), (-24, 0), (0, 0), (24, 0), (48, 0),
    (-48, 16), (-24, 16), (0, 16), (24, 16), (48, 16),
    (-42, 32), (-14, 32), (14, 32), (42, 32),
    (-24, 48), (0, 48), (24, 48),
]
dimples = "".join(
    f'<use href="#dimple" transform="translate({ball_center_x + dx:.1f} {ball_center_y + dy:.1f})"/>'
    for dx, dy in dimple_offsets
)

svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {canvas_width} 235" role="img" aria-labelledby="title desc">
  <title id="title">Sloppy Golf</title>
  <desc id="desc">Cherry Bomb One Sloppy Golf wordmark in EverElms green and blue, with a golf ball on a tee replacing the second letter O.</desc>
  <defs>
    <linearGradient id="dimple-bowl" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#b8cdd6"/>
      <stop offset=".48" stop-color="#e6eff2"/>
      <stop offset="1" stop-color="#ffffff"/>
    </linearGradient>
    <g id="dimple">
      <circle r="6.2" fill="url(#dimple-bowl)" stroke="#d3e1e6" stroke-width=".8"/>
      <path d="M-4.8 -1.8 A5.2 5.2 0 0 1 1.8 -5" fill="none" stroke="#9fb9c4" stroke-width="1.15" stroke-linecap="round" opacity=".82"/>
      <path d="M-1.6 5 A5.2 5.2 0 0 0 4.9 1.5" fill="none" stroke="#ffffff" stroke-width="1.35" stroke-linecap="round" opacity=".95"/>
    </g>
    <clipPath id="ball-face-clip">
      <circle cx="{ball_center_x:.1f}" cy="{ball_center_y}" r="{ball_radius - OUTLINE_WIDTH / 2 - 1:.1f}"/>
    </clipPath>
  </defs>
  <g fill="{GREEN}" stroke="{BLUE}" stroke-width="{OUTLINE_WIDTH}" stroke-linejoin="round" paint-order="stroke fill">
    {letter_paths}
  </g>
  <g aria-label="Golf ball on tee">
    <circle cx="{ball_center_x:.1f}" cy="{ball_center_y}" r="{ball_radius}" fill="#f8fbfb" stroke="{BLUE}" stroke-width="{OUTLINE_WIDTH}"/>
    <g opacity=".98" clip-path="url(#ball-face-clip)">
      {dimples}
    </g>
    <path d="M{ball_center_x - 9:.1f} {ball_center_y + 55:.1f} Q{ball_center_x:.1f} {ball_center_y + 61:.1f} {ball_center_x + 9:.1f} {ball_center_y + 55:.1f} L{ball_center_x:.1f} 220 Z" fill="#b87438"/>
  </g>
</svg>
'''

OUTPUT_PATH.write_text(svg, encoding="utf-8")
print(f"Wrote {OUTPUT_PATH} ({canvas_width}x235 viewBox)")
