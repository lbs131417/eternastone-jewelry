from collections import deque
from pathlib import Path

from PIL import Image


ASSET_DIR = Path(__file__).resolve().parents[1] / "src" / "assets"
SHAPES = [
    "round",
    "emerald",
    "pear",
    "asscher",
    "princess",
    "oval",
    "heart",
    "marquise",
    "radiant",
]


def is_background(pixel):
    r, g, b, a = pixel
    if a == 0:
        return True
    return r >= 238 and g >= 238 and b >= 238 and max(r, g, b) - min(r, g, b) <= 18


def soften_alpha(distance):
    if distance <= 0:
        return 0
    if distance == 1:
        return 54
    if distance == 2:
        return 142
    return 255


def transparent_from_edges(source):
    image = Image.open(source).convert("RGBA")
    width, height = image.size
    pixels = image.load()
    seen = [[False for _ in range(width)] for _ in range(height)]
    bg_distance = [[None for _ in range(width)] for _ in range(height)]
    queue = deque()

    for x in range(width):
        for y in (0, height - 1):
            if is_background(pixels[x, y]) and not seen[y][x]:
                seen[y][x] = True
                bg_distance[y][x] = 0
                queue.append((x, y))

    for y in range(height):
        for x in (0, width - 1):
            if is_background(pixels[x, y]) and not seen[y][x]:
                seen[y][x] = True
                bg_distance[y][x] = 0
                queue.append((x, y))

    while queue:
        x, y = queue.popleft()
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < width and 0 <= ny < height and not seen[ny][nx] and is_background(pixels[nx, ny]):
                seen[ny][nx] = True
                bg_distance[ny][nx] = 0
                queue.append((nx, ny))

    for y in range(height):
        for x in range(width):
            if seen[y][x]:
                pixels[x, y] = (*pixels[x, y][:3], 0)

    for y in range(height):
        for x in range(width):
            if seen[y][x]:
                continue
            nearest = 4
            for radius in (1, 2, 3):
                found = False
                for nx in range(max(0, x - radius), min(width, x + radius + 1)):
                    for ny in range(max(0, y - radius), min(height, y + radius + 1)):
                        if seen[ny][nx]:
                            nearest = radius
                            found = True
                            break
                    if found:
                        break
                if found:
                    break
            alpha = soften_alpha(nearest)
            if alpha < 255 and is_background(pixels[x, y]):
                pixels[x, y] = (*pixels[x, y][:3], alpha)

    return image


for shape in SHAPES:
    matches = list(ASSET_DIR.glob(f"shape-{shape}.*"))
    source = next((path for path in matches if "transparent" not in path.stem), None)
    if not source:
        continue
    output = ASSET_DIR / f"shape-{shape}-transparent.webp"
    transparent_from_edges(source).save(output, quality=94, method=6)
    print(output.name)
