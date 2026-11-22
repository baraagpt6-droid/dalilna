#!/usr/bin/env python3
"""Resolve the newest dated Geofabrik Yemen PBF filename from its HTML index."""

from html.parser import HTMLParser
import re
import sys
from urllib.parse import urlsplit


class SnapshotLinks(HTMLParser):
    def __init__(self):
        super().__init__()
        self.snapshots = []

    def handle_starttag(self, tag, attrs):
        if tag.lower() != "a":
            return
        href = dict(attrs).get("href", "")
        filename = urlsplit(href).path.rsplit("/", 1)[-1]
        match = re.fullmatch(r"yemen-(\d{6})\.osm\.pbf", filename)
        if match:
            self.snapshots.append((int(match.group(1)), filename))


def main():
    parser = SnapshotLinks()
    parser.feed(sys.stdin.read())
    if not parser.snapshots:
        print("No dated Yemen PBF snapshot links found in the Geofabrik index.", file=sys.stderr)
        return 1
    print(max(parser.snapshots, key=lambda item: item[0])[1])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
