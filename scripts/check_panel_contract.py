"""Verify factual delivery/registration declarations; not device acceptance."""
import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
COMPONENT = ROOT / 'custom_components/nikas_dyson'

def main():
    declaration = json.loads((ROOT / '.nikas-ui-standard.json').read_text())
    panel = json.loads((COMPONENT / 'panel_manifest.json').read_text())
    manifest = json.loads((COMPONENT / 'manifest.json').read_text())
    constants = (COMPONENT / 'const.py').read_text()
    ui = re.search(r'^UI_VERSION = "([^"]+)"', constants, re.M).group(1)
    integration = re.search(r'^VERSION = "([^"]+)"', constants, re.M).group(1)
    assert integration == manifest['version'] == panel['integration_version']
    assert ui == declaration['ui_version'] == panel['ui_version']
    for prefix in ('standard', 'navigation_contract'):
        assert hashlib.sha256((ROOT / declaration[prefix + '_path']).read_bytes()).hexdigest() == declaration[prefix + '_sha256']
    kit = declaration['source_kit']
    assert hashlib.sha256((ROOT / kit['path']).read_bytes()).hexdigest() == kit['sha256']
    source = (ROOT / declaration['production_entrypoint']).read_text()
    assert not re.search(r'(?m)^\s*(?:import|export)\b|\bimport\s*\(', source)
    assert source.count('customElements.define("nikas-dyson-panel"') == 1
    assert f'const UI_VERSION = "{ui}"' in source
    assert 'module_url=f"/nikas_dyson_static/nikas-dyson-panel.js?v={UI_VERSION}"' in (COMPONENT / '__init__.py').read_text()
    subprocess.run([sys.executable, str(ROOT / 'scripts/build_frontend.py'), '--check'], check=True)
    print('Delivery, versions and source hashes verified; live/device acceptance remains pending')

if __name__ == '__main__':
    main()
