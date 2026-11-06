#!/usr/bin/env bash
set -euo pipefail
bash -n scripts/testflight-build.sh
python3 - <<'PY'
import base64, datetime, json, os, plistlib, re, subprocess, tempfile
from pathlib import Path

script = Path('scripts/testflight-build.sh').resolve()
with tempfile.TemporaryDirectory(prefix='ayr-signing-check-') as scratch:
    root = Path(scratch)
    for directory in ['bin', 'workspace', 'runner', 'home']:
        (root / directory).mkdir()
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
    spec = json.loads(Path(args[args.index('--spec') + 1]).read_text())
    for target, uuid in [('AYR', '11111111-1111-1111-1111-111111111111'), ('AYRWidgets', '22222222-2222-2222-2222-222222222222')]:
        settings = spec['targets'][target]['settings']['base']
        assert settings['PROVISIONING_PROFILE_SPECIFIER'] == uuid
        assert settings['CODE_SIGN_STYLE'] == 'Manual'
        assert (Path(os.environ['HOME']) / 'Library/Developer/Xcode/UserData/Provisioning Profiles' / f'{uuid}.mobileprovision').exists()
    (Path(os.environ['RUNNER_TEMP']) / 'generated').touch()
elif command == 'xcodebuild':
    if 'archive' in args:
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
    assert args[0] == 'iTMSTransporter' and '-jwt' in args
    mode = args[args.index('-m') + 1]
    print('Transporter argument: ' + args[args.index('-jwt') + 1])
    with (Path(os.environ['RUNNER_TEMP']) / 'uploaded').open('a') as stream:
        stream.write(mode + '\\n')
    if mode == 'verify' and os.environ.get('FAIL_VERIFY') == 'true':
        sys.exit(9)
''')
    stub.chmod(0o755)
    for command in ['security', 'openssl', 'xcodegen', 'xcodebuild', 'xcrun']:
        (root / 'bin' / command).symlink_to(stub)
    def encode(data):
        return base64.b64encode(data).decode()
    fixture_key = subprocess.check_output(['ruby', '-ropenssl', '-e', "print OpenSSL::PKey::EC.generate('prime256v1').private_to_pem"])
    http_fixture = root / 'http_fixture.rb'
    http_fixture.write_text('''require 'net/http'
require 'openssl'
require 'json'
require 'base64'
class << Net::HTTP
  def start(host, port, **options)
    raise 'Unexpected host or TLS setting' unless host == 'api.appstoreconnect.apple.com' && port == 443 && options[:use_ssl]
    http = Object.new
    def http.request(request)
      raise 'App list must be unfiltered' unless request.path == '/v1/apps?limit=200&fields%5Bapps%5D=bundleId'
      parts = request['Authorization'].delete_prefix('Bearer ').split('.')
      header, payload = parts.take(2).map { |part| JSON.parse(Base64.urlsafe_decode64(part)) }
      raise 'Wrong individual token' unless header['alg'] == 'ES256' && header['kid'] == ENV['ASC_KEY_ID'] && payload['sub'] == 'user' && !payload.key?('iss')
      raise 'Excessive token lifetime' unless payload['exp'] - payload['iat'] <= 1200
      raw = Base64.urlsafe_decode64(parts[2])
      raise 'Wrong signature length' unless raw.bytesize == 64
      signature = OpenSSL::ASN1::Sequence.new(raw.bytes.each_slice(32).map { |part| OpenSSL::ASN1::Integer.new(OpenSSL::BN.new(part.pack('C*'), 2)) }).to_der
      key = OpenSSL::PKey.read(File.read(ENV.fetch('AYR_API_KEY_PATH')))
      raise 'Invalid ES256 signature' unless key.verify('SHA256', signature, parts.take(2).join('.'))
      app = { 'attributes' => { 'bundleId' => 'com.codemaker-kim.ayr' } }
      other = { 'attributes' => { 'bundleId' => 'com.example.other' } }
      scope = ENV.fetch('FIXTURE_SCOPE', 'ayr')
      data = scope == 'extra' ? [app, other] : scope == 'other' ? [other] : [app]
      body = { 'data' => data, 'links' => { 'next' => scope == 'paginated' ? 'https://api.appstoreconnect.apple.com/v1/apps?cursor=next' : nil },
               'meta' => { 'paging' => { 'total' => scope == 'total' ? 2 : data.length } } }
      response = scope == 'unauthorized' ? Net::HTTPUnauthorized.new('1.1', '401', 'Unauthorized') : Net::HTTPOK.new('1.1', '200', 'OK')
      response.body = JSON.generate(body)
      response.instance_variable_set(:@read, true)
      response
    end
    yield http
  end
end
''')
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
        UPLOAD_TO_TESTFLIGHT='false', ASC_KEY_ID='FIXTUREKEY',
        ASC_PRIVATE_KEY_P8_BASE64=encode(fixture_key), RUBYOPT=f'-r{http_fixture}')
    cases = [('export', {}, True),
             ('upload', {'UPLOAD_TO_TESTFLIGHT': 'true'}, True),
             ('archive failure', {'FAIL_ARCHIVE': 'true'}, False),
             ('wrong team', {'APPLE_TEAM_ID': 'WRONGTEAM'}, False),
             ('expired profile', {'APPLE_APP_PROFILE_BASE64': profile('com.codemaker-kim.ayr',
                 '11111111-1111-1111-1111-111111111111', ExpirationDate=datetime.datetime(2000, 1, 1))}, False),
             ('missing signing secret', {'APPLE_APP_PROFILE_BASE64': ''}, False),
             ('missing upload secret', {'UPLOAD_TO_TESTFLIGHT': 'true', 'ASC_KEY_ID': ''}, False),
             ('invalid build number', {'GITHUB_RUN_NUMBER': '10000'}, False),
             ('other app access', {'UPLOAD_TO_TESTFLIGHT': 'true', 'FIXTURE_SCOPE': 'extra'}, False),
             ('wrong app access', {'UPLOAD_TO_TESTFLIGHT': 'true', 'FIXTURE_SCOPE': 'other'}, False),
             ('paginated app access', {'UPLOAD_TO_TESTFLIGHT': 'true', 'FIXTURE_SCOPE': 'paginated'}, False),
             ('incomplete app list', {'UPLOAD_TO_TESTFLIGHT': 'true', 'FIXTURE_SCOPE': 'total'}, False),
             ('API authentication failure', {'UPLOAD_TO_TESTFLIGHT': 'true', 'FIXTURE_SCOPE': 'unauthorized'}, False),
             ('invalid individual key', {'UPLOAD_TO_TESTFLIGHT': 'true', 'ASC_PRIVATE_KEY_P8_BASE64': encode(b'invalid-fixture-key')}, False),
             ('validation failure', {'UPLOAD_TO_TESTFLIGHT': 'true', 'FAIL_VERIFY': 'true'}, False)]
    for name, changes, success in cases:
        for marker in ['uploaded', 'generated']:
            (root / 'runner' / marker).unlink(missing_ok=True)
        result = subprocess.run(['bash', str(script)], env=dict(environment, **changes), capture_output=True, text=True)
        assert (result.returncode == 0) == success, f'{name}: unexpected exit {result.returncode}: {result.stderr}'
        assert not list((root / 'runner').glob('ayr-signing.*')), f'{name}: signing files remain'
        assert not list((root / 'workspace').glob('.testflight-spec.*')), f'{name}: signing spec remains'
        assert not list((root / 'home').rglob('*.mobileprovision')), f'{name}: profiles remain'
        assert not list((root / 'home').rglob('*.p8')), f'{name}: API key remains'
        assert not re.search(r'eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+', result.stdout + result.stderr), f'{name}: JWT exposed in output'
        uploaded = root / 'runner/uploaded'
        if name == 'upload':
            assert uploaded.read_text().splitlines() == ['verify', 'upload']
        elif name == 'validation failure':
            assert uploaded.read_text().splitlines() == ['verify']
        else:
            assert not uploaded.exists(), f'{name}: unexpected upload'
        print(f'PASS TestFlight {name}')
print('TestFlight pipeline checks: 15 passed (Apple API and commands stubbed; ES256 signature verified)')
PY
