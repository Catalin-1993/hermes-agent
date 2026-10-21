"""``python -m portfolio_service --port N``: serve market data on 127.0.0.1 (token in the environment)."""

import argparse

import uvicorn

from portfolio_service.app import app


def main() -> None:
    parser = argparse.ArgumentParser(prog="portfolio_service")
    parser.add_argument("--port", type=int, required=True)
    args = parser.parse_args()
    uvicorn.run(app, host="127.0.0.1", port=args.port, log_level="warning")


main()
