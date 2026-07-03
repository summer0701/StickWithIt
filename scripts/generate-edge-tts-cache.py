import argparse
import asyncio
import json
from pathlib import Path

import edge_tts


ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = ROOT / "public" / "tts-cache"
DEFAULT_VOICE = "ko-KR-SunHiNeural"


def load_phrase_items():
    return DEFAULT_VOICE, []


async def generate(text, voice, output):
    communicate = edge_tts.Communicate(text, voice)
    await communicate.save(str(output))


async def generate_all(items, voice, force):
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    manifest = {
        "voice": voice,
        "items": {},
    }

    for item in items:
        key = item["key"]
        category = item["category"]
        text = item["text"]
        file_name = f"{key}.mp3"
        output = OUTPUT_DIR / file_name

        if force or not output.exists():
            print(f"generating {file_name}")
            await generate(text, voice, output)
        else:
            print(f"keeping {file_name}")

        manifest["items"][key] = {
            "category": category,
            "text": text,
            "file": f"/tts-cache/{file_name}",
        }

    manifest_path = OUTPUT_DIR / "manifest.json"
    manifest_path.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    dialogues_path = OUTPUT_DIR / "tts-dialogues.txt"
    dialogues_path.write_text(
        "\n".join(f"{item['key']}.mp3, {item['text']}" for item in items) + "\n",
        encoding="utf-8",
    )
    script_path = OUTPUT_DIR / "ghost-run-tts-script-v1.txt"
    script_path.write_text(
        "\n\n".join(f"{item['key']}.mp3\n{item['text']}" for item in items) + "\n",
        encoding="utf-8",
    )
    if not items:
        print("no cached running coach phrases remain; wrote empty TTS cache manifest")
    print(f"wrote {manifest_path.relative_to(ROOT)}")
    print(f"wrote {dialogues_path.relative_to(ROOT)}")
    print(f"wrote {script_path.relative_to(ROOT)}")


def parse_args():
    parser = argparse.ArgumentParser(description="Generate cached Edge TTS mp3 files for running coach phrases.")
    parser.add_argument("--voice", default=None, help=f"Edge TTS voice. Default: {DEFAULT_VOICE}")
    parser.add_argument("--force", action="store_true", help="Regenerate mp3 files even when they already exist.")
    return parser.parse_args()


def main():
    args = parse_args()
    phrase_voice, items = load_phrase_items()
    voice = args.voice or phrase_voice or DEFAULT_VOICE
    asyncio.run(generate_all(items, voice, args.force))


if __name__ == "__main__":
    main()
