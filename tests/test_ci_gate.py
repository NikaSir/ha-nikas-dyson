from pathlib import Path
import os
import subprocess
import json
import yaml

ROOT = Path(__file__).resolve().parents[1]

def test_validate_requires_all_checks_and_fails_closed():
    workflow = yaml.safe_load(next((ROOT / '.github/workflows').glob('*.yml')).read_text())
    gate = workflow['jobs']['validate']
    assert set(gate.get('needs', [])) == {'repository-checks', 'hacs', 'hassfest'}
    assert 'always()' in gate['if']
    script = gate['steps'][-1]['run']
    for state in ('success', 'failure', 'cancelled', 'skipped'):
        results = ['success', state, 'success']
        result = subprocess.run(['bash', '-e', '-c', script], env={**os.environ, 'RESULTS': json.dumps(results)}, capture_output=True)
        assert (result.returncode == 0) == (state == 'success')
