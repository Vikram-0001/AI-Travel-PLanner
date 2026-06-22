"""
utils/summariser.py
-------------------
When the conversation window exceeds the configured limit, this module
compresses the overflow messages into a single paragraph summary using
the same Groq LLM.  The most-recent `keep_after_summary` messages are
preserved verbatim for immediate context.
"""

from __future__ import annotations

from typing import Any

from groq import Groq

from core.models import ConversationMemory, Message


_SUMMARY_SYSTEM = (
    "You are a travel planning assistant.  "
    "Summarise the key facts from the following conversation excerpt "
    "in 3-5 concise sentences.  Focus on: trip destination, dates, "
    "budget, preferences, and any decisions already made.  "
    "Write in third person (e.g. 'The user wants to visit Paris…')."
)


def maybe_summarise(
    memory: ConversationMemory,
    client: Groq,
    model: str,
) -> bool:
    """
    Check whether the memory window needs compressing.  If so, summarise
    the overflow with the LLM, update `memory` in place, and return True.
    Returns False when no summarisation was needed.
    """
    if not memory.needs_summary():
        return False

    # Split: messages to summarise vs messages to keep verbatim
    overflow = memory.messages[: -memory.keep_after_summary]
    keep = memory.messages[-memory.keep_after_summary :]

    overflow_text = "\n".join(
        f"{m.role.upper()}: {m.content[:400]}"
        for m in overflow
        if m.role in ("user", "assistant")
    )

    try:
        resp = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": _SUMMARY_SYSTEM},
                {"role": "user", "content": overflow_text},
            ],
            max_tokens=300,
            temperature=0.2,
        )
        new_summary_text = resp.choices[0].message.content or ""
    except Exception:
        # Fallback: crude truncation to avoid breaking the session
        new_summary_text = overflow_text[:600] + " … [summary truncated]"

    # Append to any existing summary
    if memory.summary:
        memory.summary = memory.summary + "\n\n" + new_summary_text
    else:
        memory.summary = new_summary_text

    memory.messages = list(keep)
    return True
