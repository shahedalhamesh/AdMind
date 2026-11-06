import sys
import time

import media

if len(sys.argv) < 2:
    sys.exit('Usage: uv run python test_video.py "path\\to\\image.jpg" ["motion prompt"]')

image = sys.argv[1]
prompt = sys.argv[2] if len(sys.argv) > 2 else ""

start = time.time()
out = media.generate_video(image, prompt)
print(f"done in {round(time.time() - start)}s -> {out}")