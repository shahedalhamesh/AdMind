import sys
import time

import media

if len(sys.argv) < 3:
    sys.exit('Usage: uv run python test_video_long.py "image_path" total_seconds ["motion prompt"]')

image = sys.argv[1]
total = float(sys.argv[2])
motion = sys.argv[3] if len(sys.argv) > 3 else ""

start = time.time()
out = media.generate_long_video(image, motion, total)
print(f"done in {round(time.time() - start)}s -> {out}")