#!/usr/bin/env bash
set -euo pipefail
umask 077

for name in APPLE_TEAM_ID APPLE_DISTRIBUTION_P12_BASE64 APPLE_DISTRIBUTION_P12_PASSWORD APPLE_APP_PROFILE_BASE64 APPLE_WIDGET_PROFILE_BASE64 GITHUB_WORKSPACE RUNNER_TEMP GITHUB_RUN_NUMBER GITHUB_RUN_ATTEMPT; do
  if [[ -z "${!name:-}" ]]; then echo "Missing required setting: $name" >&2; exit 1; fi
done
case "${UPLOAD_TO_TESTFLIGHT:-false}" in
  true)
    for name in ASC_KEY_ID ASC_PRIVATE_KEY_P8_BASE64; do
      if [[ -z "${!name:-}" ]]; then echo "Missing required setting: $name" >&2; exit 1; fi
    done
    [[ "$ASC_KEY_ID" =~ ^[A-Z0-9]+$ ]] || { echo 'Invalid ASC key ID' >&2; exit 1; } ;;
  false) ;;
  *) echo 'UPLOAD_TO_TESTFLIGHT must be true or false' >&2; exit 1 ;;
esac
[[ "$GITHUB_RUN_NUMBER" =~ ^[1-9][0-9]{0,3}$ && "$GITHUB_RUN_ATTEMPT" =~ ^[1-9][0-9]?$ ]] || {
  echo 'Build number supports runs 1–9999 and attempts 1–99' >&2; exit 1;
}

signing_dir=$(mktemp -d "$RUNNER_TEMP/ayr-signing.XXXXXX")
keychain_path="$signing_dir/signing.keychain-db"
overlay_spec=$(mktemp "$GITHUB_WORKSPACE/.testflight-spec.XXXXXX")
installed_profiles=()
api_key_path=''
cleanup() {
  security delete-keychain "$keychain_path" >/dev/null 2>&1 || true
  for path in "${installed_profiles[@]-}"; do [[ -z "$path" ]] || rm -f "$path"; done
  if [[ -n "$api_key_path" ]]; then rm -f "$api_key_path"; fi
  rm -f "$overlay_spec"
  rm -rf "$signing_dir"
}
trap cleanup EXIT
export AYR_SIGNING_DIR="$signing_dir" AYR_SIGNING_SPEC="$overlay_spec"

python3 - <<'PY'
import base64, os
from pathlib import Path
directory = Path(os.environ['AYR_SIGNING_DIR'])
for setting, filename in [('APPLE_DISTRIBUTION_P12_BASE64', 'distribution.p12'),
                          ('APPLE_APP_PROFILE_BASE64', 'app.mobileprovision'),
                          ('APPLE_WIDGET_PROFILE_BASE64', 'widgets.mobileprovision')]:
    try:
        data = base64.b64decode(os.environ[setting], validate=True)
        if not data:
            raise ValueError()
    except ValueError:
        raise SystemExit(f'{setting} must contain nonempty Base64 without line breaks')
    (directory / filename).write_bytes(data)
PY
for target in app widgets; do
  security cms -D -i "$signing_dir/$target.mobileprovision" > "$signing_dir/$target.plist"
done
python3 - <<'PY'
import datetime, json, os, plistlib, re
from pathlib import Path
directory = Path(os.environ['AYR_SIGNING_DIR'])
team = os.environ['APPLE_TEAM_ID']
profiles, targets = {}, {}
for name, target, bundle in [('app', 'AYR', 'com.codemaker-kim.ayr'),
                             ('widgets', 'AYRWidgets', 'com.codemaker-kim.ayr.widgets')]:
    with (directory / f'{name}.plist').open('rb') as stream:
        profile = plistlib.load(stream)
    entitlements = profile.get('Entitlements', {})
    if profile.get('TeamIdentifier') != [team] or entitlements.get('application-identifier') != f'{team}.{bundle}':
        raise SystemExit(f'{name}: wrong team or bundle ID in provisioning profile')
    if 'group.com.codemaker-kim.ayr.shared' not in entitlements.get('com.apple.security.application-groups', []):
        raise SystemExit(f'{name}: required App Group is missing from provisioning profile')
    if entitlements.get('get-task-allow', False) or 'ProvisionedDevices' in profile or profile.get('ProvisionsAllDevices', False) or not entitlements.get('beta-reports-active', False):
        raise SystemExit(f'{name}: an App Store Connect distribution profile is required')
    if profile.get('ExpirationDate', datetime.datetime.min) <= datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None):
        raise SystemExit(f'{name}: provisioning profile has expired')
    uuid = profile.get('UUID', '')
    if not re.fullmatch(r'[A-Fa-f0-9-]{36}', uuid):
        raise SystemExit(f'{name}: invalid provisioning profile UUID')
    profiles[bundle] = uuid
    (directory / f'{name}.uuid').write_text(uuid)
    targets[target] = {'settings': {'base': {'CODE_SIGN_STYLE': 'Manual',
        'CODE_SIGN_IDENTITY': 'Apple Distribution', 'DEVELOPMENT_TEAM': team,
        'PROVISIONING_PROFILE_SPECIFIER': uuid}}}
spec = {'include': ['project.yml'], 'targets': targets}
Path(os.environ['AYR_SIGNING_SPEC']).write_text(json.dumps(spec))
with (directory / 'ExportOptions.plist').open('wb') as stream:
    plistlib.dump({'method': 'app-store-connect', 'destination': 'export', 'teamID': team,
                  'signingStyle': 'manual', 'signingCertificate': 'Apple Distribution',
                  'provisioningProfiles': profiles, 'manageAppVersionAndBuildNumber': False,
                  'uploadSymbols': True}, stream)
PY

profile_dir="$HOME/Library/Developer/Xcode/UserData/Provisioning Profiles"
mkdir -p "$profile_dir"
for target in app widgets; do
  profile_path="$profile_dir/$(cat "$signing_dir/$target.uuid").mobileprovision"
  [[ ! -e "$profile_path" ]] || { echo 'Refusing to overwrite an existing provisioning profile' >&2; exit 1; }
  installed_profiles+=("$profile_path")
  cp "$signing_dir/$target.mobileprovision" "$profile_path"
done
keychain_password=$(openssl rand -hex 24)
security create-keychain -p "$keychain_password" "$keychain_path"
security set-keychain-settings -lut 21600 "$keychain_path"
security unlock-keychain -p "$keychain_password" "$keychain_path"
security import "$signing_dir/distribution.p12" -P "$APPLE_DISTRIBUTION_P12_PASSWORD" -A -t cert -f pkcs12 -k "$keychain_path" >/dev/null
security set-key-partition-list -S apple-tool:,apple:,codesign: -k "$keychain_password" "$keychain_path" >/dev/null
security list-keychains -d user -s "$keychain_path"

cd "$GITHUB_WORKSPACE"
xcodegen generate --spec "$overlay_spec"
xcodebuild -quiet -project AYR.xcodeproj -scheme AYR -configuration Release \
  -destination 'generic/platform=iOS' -archivePath "$RUNNER_TEMP/AYR.xcarchive" \
  "CURRENT_PROJECT_VERSION=$GITHUB_RUN_NUMBER.$GITHUB_RUN_ATTEMPT" archive
xcodebuild -quiet -exportArchive -archivePath "$RUNNER_TEMP/AYR.xcarchive" \
  -exportPath "$RUNNER_TEMP/ayr-export" -exportOptionsPlist "$signing_dir/ExportOptions.plist"

if [[ "${UPLOAD_TO_TESTFLIGHT:-false}" == true ]]; then
  mkdir -p "$HOME/private_keys"
  candidate="$HOME/private_keys/ApiKey_${ASC_KEY_ID}.p8"
  [[ ! -e "$candidate" ]] || { echo 'Refusing to overwrite an existing API private key' >&2; exit 1; }
  api_key_path="$candidate"
  export AYR_API_KEY_PATH="$api_key_path"
  python3 - <<'PY'
import base64, os
from pathlib import Path
Path(os.environ['AYR_API_KEY_PATH']).write_bytes(base64.b64decode(os.environ['ASC_PRIVATE_KEY_P8_BASE64'], validate=True))
PY
  ruby - <<'RUBY'
require 'base64'
require 'json'
require 'net/http'
require 'openssl'
require 'open3'

begin
  encode = ->(value) { Base64.urlsafe_encode64(value, padding: false) }
  issued = Time.now.to_i - 30
  header = { alg: 'ES256', kid: ENV.fetch('ASC_KEY_ID'), typ: 'JWT' }
  payload = { sub: 'user', iat: issued, exp: issued + 1200, aud: 'appstoreconnect-v1' }
  input = [header, payload].map { |part| encode.call(JSON.generate(part)) }.join('.')
  key = OpenSSL::PKey.read(File.read(ENV.fetch('AYR_API_KEY_PATH')))
  raise 'Invalid signing curve' unless key.is_a?(OpenSSL::PKey::EC) && key.group.curve_name == 'prime256v1'
  signature = OpenSSL::ASN1.decode(key.sign('SHA256', input)).value.map do |integer|
    bytes = integer.value.to_s(2)
    raise 'Invalid signature size' if bytes.bytesize > 32
    bytes.rjust(32, "\0")
  end.join
  token = "#{input}.#{encode.call(signature)}"

  uri = URI('https://api.appstoreconnect.apple.com/v1/apps?limit=200&fields%5Bapps%5D=bundleId')
  request = Net::HTTP::Get.new(uri)
  request['Authorization'] = "Bearer #{token}"
  response = Net::HTTP.start(uri.host, uri.port, use_ssl: true, open_timeout: 20, read_timeout: 30) { |http| http.request(request) }
  abort 'Individual API key authentication failed' unless response.is_a?(Net::HTTPSuccess)
  body = JSON.parse(response.body)
  apps = body.fetch('data')
  unless apps.is_a?(Array) && apps.any? { |app| app.dig('attributes', 'bundleId') == 'com.codemaker-kim.ayr' }
    abort 'Upload key cannot access AYR'
  end
  puts 'Verified individual key can access AYR'

  %w[verify upload].each do |mode|
    Open3.popen2e('xcrun', 'iTMSTransporter', '-m', mode, '-assetFile', "#{ENV.fetch('RUNNER_TEMP')}/ayr-export/AYR.ipa", '-jwt', token, '-v', 'off') do |stdin, output, process|
      stdin.close
      output.each_line { |line| STDOUT.write(line.gsub(token, '[REDACTED]')) }
      abort "Transporter #{mode} failed" unless process.value.success?
    end
  end
rescue StandardError
  abort 'Could not verify the individual key or complete the upload'
end
RUBY
  echo 'Upload accepted. Wait for Apple processing and assign the build to an internal TestFlight group.'
else
  echo 'IPA exported. App Store Connect upload was not requested.'
fi
