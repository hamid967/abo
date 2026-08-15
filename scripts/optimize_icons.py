from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
FILES = [
    ROOT / "assets/images/icon.png",
    ROOT / "assets/images/splash-icon.png",
    ROOT / "assets/images/favicon.png",
    ROOT / "assets/images/android-icon-foreground.png",
]

for path in FILES:
    with Image.open(path) as image:
        image = image.convert("RGBA")
        image.thumbnail((1024, 1024), Image.Resampling.LANCZOS)
        image.save(path, format="PNG", optimize=True, compress_level=9)
    print(f"Optimized {path.name}: {path.stat().st_size} bytes")
