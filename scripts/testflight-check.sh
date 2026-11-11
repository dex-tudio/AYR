#!/usr/bin/env bash
set -euo pipefail
bash -n scripts/testflight-build.sh
bash -n scripts/prepare-ios.sh
python3 - <<'PY'
import base64, datetime, json, os, plistlib, shutil, subprocess, tempfile
from pathlib import Path

script = Path('scripts/testflight-build.sh').resolve()
with tempfile.TemporaryDirectory(prefix='ayr-signing-check-') as scratch:
    root = Path(scratch)
    for directory in ['bin', 'workspace', 'runner', 'home']:
        (root / directory).mkdir()
    (root / 'workspace/scripts').mkdir()
    shutil.copy('scripts/prepare-ios.sh', root / 'workspace/scripts/prepare-ios.sh')
    stub = root / 'bin/stub'
    stub.write_text('''#!/usr/bin/env python3
import json, os, sys
from pathlib import Path
command, args = Path(sys.argv[0]).name, sys.argv[1:]
if command == 'security':
    if args[0] == 'cms':
        sys.stdout.buffer.write(Path(args[args.index('-i') + 1]).read_bytes())
    elif args[0] == 'create-keychain':
        Path(args[-1]).touch()
    elif args[0] == 'delete-keychain':
        Path(args[-1]).unlink(missing_ok=True)
elif command == 'openssl':
    print('fixture-random-password')
elif command == 'xcodegen':
    if os.environ.get('FAIL_GENERATE') == 'true':
        sys.exit(8)
    spec = json.loads(Path(args[args.index('--spec') + 1]).read_text())
    for target, uuid in [('AYR', '11111111-1111-1111-1111-111111111111'), ('AYRWidgets', '22222222-2222-2222-2222-222222222222')]:
        settings = spec['targets'][target]['settings']['base']
        assert settings['PROVISIONING_PROFILE_SPECIFIER'] == uuid
        assert settings['CODE_SIGN_STYLE'] == 'Manual'
        assert (Path(os.environ['HOME']) / 'Library/Developer/Xcode/UserData/Provisioning Profiles' / f'{uuid}.mobileprovision').exists()
    (Path(os.environ['RUNNER_TEMP']) / 'generated').touch()
elif command == 'pod':
    if args == ['--version']:
        print('1.16.2 (stub)')
    else:
        assert args[0] == 'install'
        assert (Path(os.environ['RUNNER_TEMP']) / 'generated').exists()
        if os.environ.get('FAIL_POD') == 'true':
            sys.exit(7)
        (Path(os.environ['RUNNER_TEMP']) / 'pods-installed').touch()
elif command == 'xcodebuild':
    if 'archive' in args:
        assert args[args.index('-workspace') + 1] == 'AYR.xcworkspace'
        assert '-project' not in args
        assert (Path(os.environ['RUNNER_TEMP']) / 'pods-installed').exists()
        assert 'CURRENT_PROJECT_VERSION=42.2' in args
        if os.environ.get('FAIL_ARCHIVE') == 'true':
            sys.exit(9)
    elif '-exportArchive' in args:
        import plistlib
        with open(args[args.index('-exportOptionsPlist') + 1], 'rb') as stream:
            options = plistlib.load(stream)
        assert options['method'] == 'app-store-connect'
        assert len(options['provisioningProfiles']) == 2
        target = Path(args[args.index('-exportPath') + 1])
        target.mkdir(exist_ok=True)
        (target / 'AYR.ipa').touch()
elif command == 'xcrun':
    with (Path(os.environ['RUNNER_TEMP']) / 'uploaded').open('a') as stream:
        stream.write(args[1] + '\\n')
    if os.environ.get('REJECT_BUNDLE') == 'true':
        print('VERIFY FAILED with 1 error')
''')
    stub.chmod(0o755)
    for command in ['security', 'openssl', 'xcodegen', 'pod', 'xcodebuild', 'xcrun']:
        (root / 'bin' / command).symlink_to(stub)
    def encode(data):
        return base64.b64encode(data).decode()
    def profile(bundle, uuid, **changes):
        data = {'TeamIdentifier': ['FIXTURE123'], 'UUID': uuid,
                'ExpirationDate': datetime.datetime.now() + datetime.timedelta(days=2),
                'Entitlements': {'application-identifier': f'FIXTURE123.{bundle}',
                    'com.apple.security.application-groups': ['group.com.codemaker-kim.ayr.shared'],
                    'get-task-allow': False, 'beta-reports-active': True}}
        data.update(changes)
        return encode(plistlib.dumps(data))
    environment = dict(os.environ, PATH=f'{root / "bin"}:{os.environ["PATH"]}',
        HOME=str(root / 'home'), GITHUB_WORKSPACE=str(root / 'workspace'),
        RUNNER_TEMP=str(root / 'runner'), GITHUB_RUN_NUMBER='42', GITHUB_RUN_ATTEMPT='2',
        APPLE_TEAM_ID='FIXTURE123', APPLE_DISTRIBUTION_P12_BASE64=encode(b'fixture-p12'),
        APPLE_DISTRIBUTION_P12_PASSWORD='fixture-password',
        APPLE_APP_PROFILE_BASE64=profile('com.codemaker-kim.ayr', '11111111-1111-1111-1111-111111111111'),
        APPLE_WIDGET_PROFILE_BASE64=profile('com.codemaker-kim.ayr.widgets', '22222222-2222-2222-2222-222222222222'),
        UPLOAD_TO_TESTFLIGHT='false', ASC_KEY_ID='FIXTUREKEY', ASC_ISSUER_ID='fixture-issuer',
        ASC_PRIVATE_KEY_P8_BASE64=encode(b'fixture-p8'))
    cases = [('export', {}, True),
             ('upload', {'UPLOAD_TO_TESTFLIGHT': 'true'}, True),
             ('archive failure', {'FAIL_ARCHIVE': 'true'}, False),
             ('generation failure', {'FAIL_GENERATE': 'true'}, False),
             ('pod failure', {'FAIL_POD': 'true'}, False),
             ('wrong team', {'APPLE_TEAM_ID': 'WRONGTEAM'}, False),
             ('expired profile', {'APPLE_APP_PROFILE_BASE64': profile('com.codemaker-kim.ayr',
                 '11111111-1111-1111-1111-111111111111', ExpirationDate=datetime.datetime(2000, 1, 1))}, False),
             ('missing signing secret', {'APPLE_APP_PROFILE_BASE64': ''}, False),
             ('missing upload secret', {'UPLOAD_TO_TESTFLIGHT': 'true', 'ASC_KEY_ID': ''}, False),
             ('invalid build number', {'GITHUB_RUN_NUMBER': '10000'}, False),
             ('rejected bundle with exit 0', {'UPLOAD_TO_TESTFLIGHT': 'true', 'REJECT_BUNDLE': 'true'}, False)]
    for name, changes, success in cases:
        for marker in ['uploaded', 'generated', 'pods-installed']:
            (root / 'runner' / marker).unlink(missing_ok=True)
        result = subprocess.run(['bash', str(script)], env=dict(environment, **changes), capture_output=True, text=True)
        assert (result.returncode == 0) == success, f'{name}: unexpected exit {result.returncode}: {result.stderr}'
        assert not list((root / 'runner').glob('ayr-signing.*')), f'{name}: signing files remain'
        assert not list((root / 'workspace').glob('.testflight-spec.*')), f'{name}: signing spec remains'
        assert not list((root / 'home').rglob('*.mobileprovision')), f'{name}: profiles remain'
        assert not list((root / 'home').rglob('*.p8')), f'{name}: API key remains'
        uploaded = root / 'runner/uploaded'
        if name == 'upload':
            assert uploaded.read_text().splitlines() == ['--validate-app', '--upload-app']
        elif name == 'rejected bundle with exit 0':
            assert uploaded.read_text().splitlines() == ['--validate-app']
        else:
            assert not uploaded.exists(), f'{name}: unexpected upload'
        print(f'PASS TestFlight {name}')
print('TestFlight pipeline checks: 11 passed (Apple and pod commands stubbed)')
PY
