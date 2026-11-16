#!/usr/bin/env python3
"""Validate release updater assets and write the domestic mirror metadata."""
from __future__ import annotations

import argparse
import hashlib
import json
import re
from pathlib import Path

TARGETS = ('windows-x64', 'macos-arm64', 'macos-x64', 'linux-arm64', 'linux-x64')
VERSION = re.compile(r'^[0-9]+\.[0-9]+\.[0-9]+$')
REVISION = re.compile(r'^[0-9a-f]{40}$')


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open('rb') as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b''):
            digest.update(chunk)
    return digest.hexdigest()


def parse_sums(path: Path) -> dict[str, str]:
    result: dict[str, str] = {}
    for line in path.read_text(encoding='utf-8').splitlines():
        digest, separator, name = line.partition('  ')
        if separator != '  ' or not re.fullmatch(r'[0-9a-f]{64}', digest) or '/' in name or '\\' in name or name in result:
            raise ValueError('Invalid SHA256SUMS.txt entry')
        result[name] = digest
    return result


def prepare(release_dir: Path, output: Path, version: str, revision: str, repository: str, public_base: str) -> dict:
    if not VERSION.fullmatch(version):
        raise ValueError('A stable numeric version is required')
    if not REVISION.fullmatch(revision):
        raise ValueError('A full lowercase source revision is required')
    if not re.fullmatch(r'[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+', repository):
        raise ValueError('Invalid repository')
    public_base = public_base.rstrip('/')
    if not public_base.startswith('https://'):
        raise ValueError('The public update base must use HTTPS')
    sums_path = release_dir / 'SHA256SUMS.txt'
    sums = parse_sums(sums_path)
    names = ['SHA256SUMS.txt']
    for target in TARGETS:
        names.extend((f'ClickPulse-{version}-{target}.zip', f'ClickPulse-{version}-{target}.manifest.json'))
    assets = []
    for name in names:
        path = release_dir / name
        if not path.is_file() or path.stat().st_size <= 0:
            raise ValueError(f'Missing mirrored updater asset: {name}')
        digest = sha256(path)
        if name != 'SHA256SUMS.txt' and sums.get(name) != digest:
            raise ValueError(f'Checksum mismatch for mirrored updater asset: {name}')
        if name.endswith('.manifest.json'):
            manifest = json.loads(path.read_text(encoding='utf-8'))
            if manifest.get('version') != version or manifest.get('source_revision') != revision:
                raise ValueError(f'Manifest provenance mismatch: {name}')
        assets.append({
            'name': name,
            'browser_download_url': f'{public_base}/api/v1/updates/download/{version}/{name}',
            'size': path.stat().st_size,
            'digest': f'sha256:{digest}',
        })
    metadata = {
        'tag_name': f'v{version}',
        'html_url': f'https://github.com/{repository}/releases/tag/v{version}',
        'draft': False,
        'prerelease': False,
        'source_revision': revision,
        'assets': assets,
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    return metadata


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--release-dir', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--version', required=True)
    parser.add_argument('--revision', required=True)
    parser.add_argument('--repository', required=True)
    parser.add_argument('--public-base', default='https://clickpulse.fangdutex.cn')
    args = parser.parse_args()
    prepare(args.release_dir, args.output, args.version, args.revision, args.repository, args.public_base)


if __name__ == '__main__':
    main()
