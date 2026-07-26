from __future__ import annotations

import os
import re
from pathlib import Path


SAFE_IDENTIFIER = re.compile(r"^[A-Za-z0-9_-]+$")


class LocalPdfStorage:
    def __init__(self, root: str | Path):
        self.root = Path(root).resolve()

    def _validate(self, value: str) -> None:
        if not SAFE_IDENTIFIER.fullmatch(value):
            raise ValueError("Unsafe storage identifier")

    def path_for(self, user_id: str, document_id: str) -> Path:
        self._validate(user_id)
        self._validate(document_id)
        path = (self.root / user_id / f"{document_id}.pdf").resolve()
        if self.root not in path.parents:
            raise ValueError("Unsafe storage identifier")
        return path

    def save(self, user_id: str, document_id: str, data: bytes) -> Path:
        destination = self.path_for(user_id, document_id)
        destination.parent.mkdir(parents=True, exist_ok=True)
        temporary = Path(f"{destination}.tmp")
        temporary.write_bytes(data)
        os.replace(temporary, destination)
        return destination

    def delete(self, user_id: str, document_id: str) -> bool:
        path = self.path_for(user_id, document_id)
        if not path.exists():
            return False
        path.unlink()
        try:
            path.parent.rmdir()
        except OSError:
            pass
        return True
