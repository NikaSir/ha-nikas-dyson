from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def test_required_repository_support_files_are_present():
    required_paths = (
        ".editorconfig",
        ".github/CODEOWNERS",
        ".github/dependabot.yml",
        "CHANGELOG.md",
        "docs/RELEASES.md",
    )

    missing = [path for path in required_paths if not (ROOT / path).is_file()]

    assert not missing, f"Missing repository support files: {', '.join(missing)}"
