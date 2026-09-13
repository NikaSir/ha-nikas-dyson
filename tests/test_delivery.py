import json
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parents[1]
COMPONENT = ROOT / 'custom_components/nikas_dyson'


class DeliveryTests(unittest.TestCase):
    def test_registered_entrypoint_is_autonomous_and_versioned(self):
        registration = (COMPONENT / '__init__.py').read_text()
        match = re.search(r'module_url=f"/nikas_dyson_static/([^?]+)\?v=\{UI_VERSION\}"', registration)
        self.assertIsNotNone(match)
        source = (COMPONENT / 'frontend' / match.group(1)).read_text()
        self.assertNotRegex(source, r'(?m)^\s*(?:import|export)\b|\bimport\s*\(')
        self.assertEqual(source.count('customElements.define("nikas-dyson-panel"'), 1)
        const = (COMPONENT / 'const.py').read_text()
        version = re.search(r'^UI_VERSION = "([^"]+)"', const, re.M).group(1)
        self.assertIn(f'const UI_VERSION = "{version}"', source)

    def test_documented_integration_version_matches_manifest(self):
        manifest = json.loads((COMPONENT / 'manifest.json').read_text())
        self.assertIn(f'**{manifest["version"]}**', (ROOT / 'README.md').read_text())
