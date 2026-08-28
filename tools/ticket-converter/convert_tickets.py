import argparse
import json
import re
import shutil
import subprocess
from pathlib import Path

from pypdf import PdfReader


SEGMENT_RE = re.compile(r"^(?P<ticket>\d+)_(?P<start>\d+)-(?P<end>\d+).*\.pdf$", re.IGNORECASE)
COMMENT_RE = re.compile(r"^(?P<ticket>\d+)-komment.*\.pdf$", re.IGNORECASE)


def read_pdf_text(path: Path) -> str:
    reader = PdfReader(str(path))
    pages = []
    for page in reader.pages:
        pages.append(page.extract_text() or "")
    return "\n".join(pages).strip()


def find_pdftoppm(explicit_path: str | None) -> str | None:
    if explicit_path:
        return explicit_path

    bundled = Path.home() / ".cache" / "codex-runtimes" / "codex-primary-runtime" / "dependencies" / "native" / "poppler" / "Library" / "bin" / "pdftoppm.exe"
    if bundled.exists():
        return str(bundled)

    return shutil.which("pdftoppm")


def render_pdf(path: Path, image_dir: Path, pdftoppm: str | None) -> str:
    image_dir.mkdir(parents=True, exist_ok=True)
    image_name = path.stem.replace(".", "-")
    output_prefix = image_dir / image_name

    if not pdftoppm:
        return ""

    subprocess.run(
        [pdftoppm, "-png", "-r", "180", "-singlefile", str(path), str(output_prefix)],
        check=True,
    )
    return f"/tickets/images/{image_name}.png"


def make_question(number: int, source_file: Path, source_image: str, raw_text: str, hint: str) -> dict:
    return {
        "number": number,
        "text": f"Заполните текст вопроса {number} из файла {source_file.name}.",
        "image": source_image,
        "answers": [
            {"number": 1, "text": "Заполните вариант ответа 1"},
            {"number": 2, "text": "Заполните вариант ответа 2"},
            {"number": 3, "text": "Заполните вариант ответа 3"},
        ],
        "correctAnswer": 1,
        "hint": hint,
        "source": {
            "file": source_file.name,
            "rawText": raw_text,
        },
    }


def convert(input_dir: Path, output_dir: Path, pdftoppm: str | None) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    image_dir = output_dir / "images"

    comments: dict[int, str] = {}
    segments: list[tuple[int, int, int, Path]] = []

    for path in sorted(input_dir.glob("*.pdf*")):
        segment_match = SEGMENT_RE.match(path.name)
        if segment_match:
            segments.append(
                (
                    int(segment_match.group("ticket")),
                    int(segment_match.group("start")),
                    int(segment_match.group("end")),
                    path,
                )
            )
            continue

        comment_match = COMMENT_RE.match(path.name)
        if comment_match:
            comments[int(comment_match.group("ticket"))] = read_pdf_text(path)

    tickets: dict[int, dict] = {}

    for ticket_number, start, end, path in segments:
        ticket = tickets.setdefault(
            ticket_number,
            {
                "ticketNumber": ticket_number,
                "title": f"Билет {ticket_number}",
                "questions": [],
            },
        )
        source_image = render_pdf(path, image_dir, pdftoppm)
        raw_text = read_pdf_text(path)
        hint = comments.get(ticket_number, "")

        for question_number in range(start, end + 1):
            ticket["questions"].append(
                make_question(question_number, path, source_image, raw_text, hint)
            )

    result = sorted(tickets.values(), key=lambda item: item["ticketNumber"])
    for ticket in result:
        ticket["questions"].sort(key=lambda item: item["number"])

    with (output_dir / "tickets.json").open("w", encoding="utf-8") as handle:
        json.dump(result, handle, ensure_ascii=False, indent=2)


def main() -> None:
    parser = argparse.ArgumentParser(description="Convert driving-school ticket PDFs into MVP JSON.")
    parser.add_argument("--input", required=True, help="Folder with ticket PDFs.")
    parser.add_argument("--output", required=True, help="Output folder, usually public/tickets.")
    parser.add_argument("--pdftoppm", default=None, help="Optional path to pdftoppm executable.")
    args = parser.parse_args()

    convert(Path(args.input), Path(args.output), find_pdftoppm(args.pdftoppm))


if __name__ == "__main__":
    main()
