#!/usr/bin/env python3
"""Assemble and validate the static ClickPulse website."""
from __future__ import annotations

import argparse
import json
import re
import shutil
import xml.etree.ElementTree as ET
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / 'website'
REVISION = re.compile(r'^[0-9a-f]{40}$')
REQUIRED_IDS = {
    'main', 'features', 'privacy', 'download', 'smart-download', 'release-state',
    'download-windows', 'download-mac-arm', 'download-mac-x64',
    'download-linux-x64', 'download-linux-arm', 'release-notes',
}


class SiteParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.ids: list[str] = []
        self.references: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = dict(attrs)
        if values.get('id'):
            self.ids.append(values['id'])
        for name in ('href', 'src'):
            value = values.get(name)
            if value:
                self.references.append(value)


def validate(site: Path, revision: str) -> None:
    index = site / 'index.html'
    text = index.read_text(encoding='utf-8')
    marker = f'<meta name="clickpulse-site-revision" content="{revision}">'
    if marker not in text:
        raise ValueError('Website revision marker was not injected')
    parser = SiteParser()
    parser.feed(text)
    duplicates = sorted({value for value in parser.ids if parser.ids.count(value) > 1})
    if duplicates:
        raise ValueError(f'Duplicate HTML ids: {duplicates}')
    missing = sorted(REQUIRED_IDS - set(parser.ids))
    if missing:
        raise ValueError(f'Missing required HTML ids: {missing}')
    for reference in parser.references:
        parsed = urlsplit(reference)
        if parsed.scheme or reference.startswith(('#', 'mailto:', 'tel:')):
            continue
        target = site / ('index.html' if parsed.path == '/' else parsed.path.lstrip('/'))
        if parsed.path and not target.is_file():
            raise ValueError(f'Missing local website asset: {reference}')
    manifest = json.loads((site / 'site.webmanifest').read_text(encoding='utf-8'))
    if manifest.get('start_url') != '/' or manifest.get('theme_color') != '#171126':
        raise ValueError('Invalid web manifest')
    ET.parse(site / 'sitemap.xml')
    if 'http://' in text:
        raise ValueError('Website contains an insecure HTTP link')


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', type=Path, default=ROOT / 'dist' / 'website')
    parser.add_argument('--revision', required=True)
    args = parser.parse_args()
    revision = args.revision.lower()
    if not REVISION.fullmatch(revision):
        raise ValueError('A full lowercase Git revision is required')
    output = args.output.resolve()
    dist = (ROOT / 'dist').resolve()
    if dist not in output.parents:
        raise ValueError('Website output must be a child of dist/')
    if output.exists():
        shutil.rmtree(output)
    shutil.copytree(SOURCE, output)
    index = output / 'index.html'
    text = index.read_text(encoding='utf-8')
    if text.count('__SITE_REVISION__') != 3:
        raise ValueError('Expected revision placeholders for the page, stylesheet and script')
    index.write_text(text.replace('__SITE_REVISION__', revision), encoding='utf-8')
    validate(output, revision)
    print(f'Website ready at {output.relative_to(ROOT)} for {revision}')


if __name__ == '__main__':
    main()
