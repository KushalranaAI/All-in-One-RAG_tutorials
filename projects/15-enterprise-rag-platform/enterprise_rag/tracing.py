"""Per-request traces written as JSON lines."""

import json
import time
import uuid
from dataclasses import dataclass, field

from .config import TRACE_FILE


@dataclass
class Trace:
    request_id: str = field(default_factory=lambda: uuid.uuid4().hex[:12])
    started: float = field(default_factory=time.time)
    steps: list[dict] = field(default_factory=list)

    def log(self, step: str, **data) -> None:
        self.steps.append({"step": step, "t_ms": round((time.time() - self.started) * 1000), **data})

    def save(self) -> None:
        TRACE_FILE.parent.mkdir(exist_ok=True)
        with TRACE_FILE.open("a") as f:
            f.write(json.dumps({"request_id": self.request_id, "started": self.started, "steps": self.steps}, default=str) + "\n")


def load_trace(request_id: str) -> dict | None:
    if not TRACE_FILE.exists():
        return None
    for line in TRACE_FILE.read_text().splitlines():
        row = json.loads(line)
        if row["request_id"] == request_id:
            return row
    return None
