import hashlib
import json
import tempfile
import unittest
from pathlib import Path

from scripts.prepare_update_mirror import TARGETS, changelog_notes, prepare


class UpdateMirrorTests(unittest.TestCase):
    def fixture(self, root: Path, version='1.2.3', revision='a' * 40):
        sums = []
        for target in TARGETS:
            archive = root / f'ClickPulse-{version}-{target}.zip'
            archive.write_bytes(f'archive-{target}'.encode())
            manifest = root / f'ClickPulse-{version}-{target}.manifest.json'
            manifest.write_text(json.dumps({'version': version, 'source_revision': revision}), encoding='utf-8')
            for path in (archive, manifest):
                sums.append(f'{hashlib.sha256(path.read_bytes()).hexdigest()}  {path.name}')
        (root / 'SHA256SUMS.txt').write_text('\n'.join(sums) + '\n', encoding='utf-8')

    def test_writes_exact_https_urls_and_digests_for_every_updater_asset(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self.fixture(root)
            metadata = prepare(root, root / 'latest.json', '1.2.3', 'a' * 40, 'owner/repo', 'https://clickpulse.example/', ['Direct in-app updates', 'Clear release notes'])
            self.assertEqual(metadata['tag_name'], 'v1.2.3')
            self.assertEqual(metadata['notes'], ['Direct in-app updates', 'Clear release notes'])
            self.assertEqual(len(metadata['assets']), 11)
            for asset in metadata['assets']:
                self.assertTrue(asset['browser_download_url'].startswith('https://clickpulse.example/api/v1/updates/download/1.2.3/'))
                self.assertRegex(asset['digest'], r'^sha256:[0-9a-f]{64}$')

    def test_extracts_bounded_notes_from_the_matching_changelog_section(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'CHANGELOG.md'
            path.write_text('# Changelog\n\n## 1.2.3 · Today\n\n### New\n\n- First change.\n- Second change.\n\n## 1.2.2 · Yesterday\n\n- Old change.\n', encoding='utf-8')
            self.assertEqual(changelog_notes(path, '1.2.3'), ['First change.', 'Second change.'])
            with self.assertRaisesRegex(ValueError, 'Missing changelog'):
                changelog_notes(path, '9.9.9')

    def test_rejects_package_checksum_or_manifest_provenance_mismatch(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self.fixture(root)
            (root / 'ClickPulse-1.2.3-windows-x64.zip').write_bytes(b'tampered')
            with self.assertRaisesRegex(ValueError, 'Checksum mismatch'):
                prepare(root, root / 'latest.json', '1.2.3', 'a' * 40, 'owner/repo', 'https://clickpulse.example')
            self.fixture(root)
            manifest = root / 'ClickPulse-1.2.3-windows-x64.manifest.json'
            manifest.write_text(json.dumps({'version': '9.9.9', 'source_revision': 'a' * 40}), encoding='utf-8')
            digest = hashlib.sha256(manifest.read_bytes()).hexdigest()
            sums = (root / 'SHA256SUMS.txt').read_text(encoding='utf-8')
            lines = [f'{digest}  {manifest.name}' if line.endswith(manifest.name) else line for line in sums.splitlines()]
            (root / 'SHA256SUMS.txt').write_text('\n'.join(lines) + '\n', encoding='utf-8')
            with self.assertRaisesRegex(ValueError, 'provenance mismatch'):
                prepare(root, root / 'latest.json', '1.2.3', 'a' * 40, 'owner/repo', 'https://clickpulse.example')


if __name__ == '__main__':
    unittest.main()
