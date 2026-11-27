#!/usr/bin/env bash
set -euo pipefail
bash -n scripts/select-xcode.sh
python3 - <<'PY'
import os, subprocess, tempfile
from pathlib import Path

source = Path('scripts/select-xcode.sh').read_text()
cases = [
    ('pinned alongside other releases', ['26.6', '27.0', '27.1', '27.2', '28.0'], '27B52', True),
    ('missing pin with older release', ['27.1'], '27A9275', False),
    ('missing pin with newer release', ['28.0'], '28A100', False),
    ('wrong pinned build', ['27.2'], 'unexpected-build', False),
    ('only pinned release', ['27.2'], '27B52', True),
]
for name, versions, build, succeeds in cases:
    with tempfile.TemporaryDirectory(prefix='ayr-xcode-check-') as scratch:
        root = Path(scratch)
        applications, commands = root / 'Applications', root / 'bin'
        commands.mkdir()
        for version in versions:
            (applications / f'Xcode_{version}.app/Contents/Developer').mkdir(parents=True)
        script = root / 'select-xcode.sh'
        script.write_text(source.replace('/Applications', applications.as_posix()))
        stub = commands / 'stub'
        stub.write_text('''#!/usr/bin/env python3
import os, sys
from pathlib import Path
command, args = Path(sys.argv[0]).name, sys.argv[1:]
selection = Path(os.environ['SELECTION'])
if command == 'sudo':
    os.execvp(args[0], args)
elif command == 'xcode-select':
    assert args[0] == '--switch'
    selection.write_text(args[1])
elif command == 'xcodebuild':
    assert args == ['-version']
    version = Path(selection.read_text()).parents[1].name.removeprefix('Xcode_').removesuffix('.app')
    print(f'Xcode {version}\\nBuild version {os.environ["XCODE_BUILD"]}')
''')
        stub.chmod(0o755)
        for command in ['sudo', 'xcode-select', 'xcodebuild']:
            (commands / command).symlink_to(stub)
        selection = root / 'selected'
        result = subprocess.run(['bash', str(script)], capture_output=True, text=True,
            env=dict(os.environ, PATH=f'{commands}:{os.environ["PATH"]}',
                SELECTION=str(selection), XCODE_BUILD=build))
        assert (result.returncode == 0) == succeeds, (name, result.stdout, result.stderr)
        if succeeds:
            assert selection.read_text() == str(applications / 'Xcode_27.2.app/Contents/Developer'), name
        elif '27.2' not in versions:
            assert not selection.exists(), name
        print(f'passed: {name}')
print(f'Xcode selection checks passed ({len(cases)} cases)')
PY
