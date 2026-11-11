import sys
import time

import media

if len(sys.argv) < 2:
    sys.exit('Usage: uv run python test_image.py "prompt" [aspect_ratio]')

prompt = sys.argv[1]
aspect = sys.argv[2] if len(sys.argv) > 2 else "1:1"

start = time.time()
out = media.generate_image(prompt, aspect_ratio=aspect)
print(f"done in {round(time.time() - start)}s -> {out}")