"""Simple file + console logging for evaluation runs."""

import logging
import sys
import time
from pathlib import Path

from germedbench.config import settings


def setup_run_logger(task: str, model: str | None = None) -> logging.Logger:
    """Create a logger that writes to console + results/<task>_<timestamp>.log."""
    timestamp = time.strftime("%Y%m%d_%H%M%S")
    log_dir = settings.results_dir / "logs"
    log_dir.mkdir(parents=True, exist_ok=True)

    name = f"{task}_{timestamp}"
    log_path = log_dir / f"{name}.log"

    logger = logging.getLogger(name)
    logger.setLevel(logging.DEBUG)

    # File handler — verbose (DEBUG)
    fh = logging.FileHandler(log_path, encoding="utf-8")
    fh.setLevel(logging.DEBUG)
    fh.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] %(message)s"))

    # Console handler — concise (INFO)
    ch = logging.StreamHandler(sys.stdout)
    ch.setLevel(logging.INFO)
    ch.setFormatter(logging.Formatter("%(message)s"))

    logger.addHandler(fh)
    logger.addHandler(ch)

    logger.info(f"Log file: {log_path}")
    return logger
