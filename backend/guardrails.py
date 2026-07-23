# backend/guardrails.py
"""Input guardrails for user questions before they reach the LLM.

The /query endpoint forwards user-supplied text straight to an LLM. Without
validation a caller can:
  (a) send oversized input to run up token cost,
  (b) send empty / garbage input, or
  (c) attempt prompt injection to override the system prompt and make the
      model ignore its grounding rules ("ignore previous instructions...").

This module centralises those checks so main.py can reject bad input *before*
any expensive embedding / LLM work happens. Prompt hardening in query.py is the
second layer of defence; pattern detection here is the first.
"""
from __future__ import annotations

import re
import threading
import time
from collections import defaultdict, deque

# --- Length bounds -----------------------------------------------------------
# Enforced after stripping surrounding whitespace.
MIN_QUESTION_LENGTH = 3
MAX_QUESTION_LENGTH = 2000  # ~500 tokens; generous for a question about a document

# Hard ceiling on the raw payload, checked at the Pydantic layer so multi-KB
# bodies are rejected at parse time before this module ever runs.
MAX_RAW_QUESTION_LENGTH = 8000


class GuardrailError(Exception):
    """Raised when user input fails a guardrail check.

    Carries an HTTP status code and a safe, user-facing message so the caller
    (main.py) can translate it into an HTTPException without leaking internals.
    """

    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


# --- Prompt-injection detection ---------------------------------------------
# High-confidence override phrases. Kept multi-word / anchored to avoid false
# positives on legitimate document questions (a real question about a document
# rarely tells the analyst to ignore its instructions or reveal its prompt).
_INJECTION_PATTERNS = [
    r'ignore\s+(?:all\s+|the\s+|your\s+|previous\s+|above\s+|prior\s+|earlier\s+)+instructions',
    r'disregard\s+(?:all\s+|the\s+|your\s+|previous\s+|above\s+|prior\s+|everything)',
    r'forget\s+(?:all\s+|the\s+|your\s+|previous\s+|above\s+|everything|prior\s+)',
    r'you\s+are\s+now\s+(?:a|an|my|the)\b',
    r'pretend\s+(?:to\s+be|you\s+are|that\s+you)',
    r'act\s+as\s+(?:a|an|if|though)\b',
    r'system\s+prompt',
    r'(?:reveal|show|print|repeat|output|expose|leak)\s+(?:your|the)\s+(?:prompt|instructions|system|rules)',
    r'new\s+instructions?\s*:',
    r'</?\s*(?:system|instruction|prompt|assistant)\s*>',
    r'\bjailbreak\b',
    r'developer\s+mode',
    r'\bDAN\b',  # "Do Anything Now" jailbreak persona
]
_INJECTION_RE = re.compile('|'.join(_INJECTION_PATTERNS), re.IGNORECASE)

# Control characters (except tab / newline / carriage-return) have no place in a
# typed question and are a common obfuscation / smuggling vector.
_CONTROL_CHARS_RE = re.compile(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]')


def check_question(question: str) -> str:
    """Validate and normalise a user question. Return the cleaned question.

    Raises GuardrailError (400) if the question is empty, too short, too long,
    contains control characters, or looks like a prompt-injection attempt.
    """
    if not isinstance(question, str):
        raise GuardrailError('Question must be text.')

    cleaned = question.strip()

    if len(cleaned) < MIN_QUESTION_LENGTH:
        raise GuardrailError('Question is empty or too short.')

    if len(cleaned) > MAX_QUESTION_LENGTH:
        raise GuardrailError(
            f'Question is too long (max {MAX_QUESTION_LENGTH} characters).'
        )

    if _CONTROL_CHARS_RE.search(cleaned):
        raise GuardrailError('Question contains invalid control characters.')

    if _INJECTION_RE.search(cleaned):
        raise GuardrailError(
            'This question was blocked: it looks like an attempt to override '
            'the assistant. Ask a question about the document instead.'
        )

    return cleaned


# --- Per-user rate limiting --------------------------------------------------
# In-memory sliding window. Good enough for a single-process deployment. For a
# multi-worker / multi-host setup, move this to Redis so the window is shared
# across processes. The dict grows with the number of distinct users seen in a
# window, which is bounded and acceptable at this scale.
RATE_LIMIT_MAX_REQUESTS = 30
RATE_LIMIT_WINDOW_SECONDS = 60

_request_log: dict[str, deque] = defaultdict(deque)
_rate_lock = threading.Lock()


def enforce_rate_limit(user_id: str, now: float | None = None) -> None:
    """Allow at most RATE_LIMIT_MAX_REQUESTS per user per window.

    Raises GuardrailError (429) when the limit is exceeded.
    """
    now = time.monotonic() if now is None else now
    cutoff = now - RATE_LIMIT_WINDOW_SECONDS
    with _rate_lock:
        timestamps = _request_log[user_id]
        while timestamps and timestamps[0] < cutoff:
            timestamps.popleft()
        if len(timestamps) >= RATE_LIMIT_MAX_REQUESTS:
            raise GuardrailError(
                'Too many requests. Please wait a moment and try again.',
                status_code=429,
            )
        timestamps.append(now)
