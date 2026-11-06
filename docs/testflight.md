# Windows에서 TestFlight 설치까지

현재 코드는 앱 등록·서명 정보를 준비하면 GitHub Actions의 `TestFlight` 워크플로로 IPA를 만들고 업로드할 수 있도록 구성했습니다. 서명된 IPA 생성은 확인했고, 실제 업로드·설치는 아직 검증하지 않았습니다. 기본 실행은 **IPA 생성만** 하며, `upload_to_testflight`를 켠 수동 실행에서만 Apple로 업로드합니다.

## 1. Apple 계정에 등록

1. Developer → Certificates, Identifiers & Profiles에서 앱 ID `com.codemaker-kim.ayr`와 위젯 ID `com.codemaker-kim.ayr.widgets`를 각각 등록합니다.
2. App Group `group.com.codemaker-kim.ayr.shared`를 등록하고 두 ID에 모두 연결합니다.
3. App Store Connect → 앱 → 신규 앱에 iOS, 이름 `님 부자임?`, 기본 언어 한국어, Bundle ID `com.codemaker-kim.ayr`, SKU `AYR-IOS`를 입력해 생성합니다. 접근 권한은 본인 테스트에 필요한 범위로 제한합니다.

앱 ID와 App Group 연결을 마친 뒤 아래 프로파일을 만들어야 합니다. [Apple App Group 안내](https://developer.apple.com/help/account/identifiers/register-an-app-group/)

## 2. Windows에서 서명 인증서 준비

키·비밀번호·인증서·프로파일은 **저장소 밖의 개인 폴더**에 보관합니다. 채팅·로그·Git·Actions artifact에 올리지 않습니다. 아래 명령은 사용자가 직접 실행하며 새 키·인증서를 만드는 작업입니다. 기존 앱의 인증서를 폐기하거나 교체할 필요는 없습니다.

Git for Windows에 포함된 OpenSSL을 사용합니다. PowerShell에서 개인 폴더로 이동한 뒤 실행합니다. 비밀번호는 명령 인수가 아닌 OpenSSL의 프롬프트에서 입력합니다.

```powershell
$opensslPath = 'C:\Program Files\Git\usr\bin\openssl.exe'
& $opensslPath genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -aes-256-cbc -out AYR-distribution.key
& $opensslPath req -new -key AYR-distribution.key -out AYR-distribution.csr
```

CSR 질문에 본인의 이름(Common Name)과 Apple 계정 이메일을 입력합니다. Apple Developer → Certificates → `+` → **Apple Distribution**에서 CSR만 업로드하고 인증서를 내려받아 같은 개인 폴더에 `distribution.cer`로 보관합니다. [Apple CSR 안내](https://developer.apple.com/help/account/certificates/create-a-certificate-signing-request/)

```powershell
& $opensslPath x509 -inform DER -in distribution.cer -out distribution.pem
& $opensslPath pkcs12 -export -inkey AYR-distribution.key -in distribution.pem -out AYR-distribution.p12
```

마지막 명령에서 입력한 Export Password가 아래 `APPLE_DISTRIBUTION_P12_PASSWORD`입니다. 내려받은 `.cer`만으로는 서명할 수 없으며, **그 CSR을 만든 개인키**가 함께 들어 있는 `.p12`가 필요합니다.

## 3. 프로파일 두 개와 업로드 키 준비

Developer → Profiles → `+` → Distribution의 **App Store Connect**를 선택합니다. 앱 ID와 앞에서 만든 Apple Distribution 인증서를 선택해 각각 생성·다운로드합니다.

| 파일 용도 | 앱 ID | 권장 이름 |
| --- | --- | --- |
| 앱 프로파일 | `com.codemaker-kim.ayr` | `AYR App Store` |
| 위젯 프로파일 | `com.codemaker-kim.ayr.widgets` | `AYR Widgets App Store` |

두 프로파일에 위의 App Group이 포함되어야 합니다. Development·Ad Hoc 프로파일은 TestFlight용이 아닙니다. [Apple 프로파일 생성 안내](https://developer.apple.com/help/account/provisioning-profiles/create-an-app-store-provisioning-profile/)

업로드에는 **AYR만 접근하는 전용 Developer 사용자의 Individual API Key**를 사용합니다.

1. 계정 소유자가 App Store Connect → 사용자 및 액세스에서 전용 Apple 계정을 Developer로 초대하고 앱 접근을 `님 부자임?` 하나로 제한합니다. Admin·Finance 역할과 보고서·Certificates, Identifiers & Profiles 권한을 추가하지 않습니다. 전용 계정은 사용자가 정하며 기존 계정의 권한을 임의로 바꾸지 않습니다.
2. 초대를 수락한 전용 계정으로 로그인하고 사용자 프로필 → Individual API Key에서 키를 생성·다운로드합니다. Key ID와 `.p8`을 보관합니다. 소유자·관리자 계정의 개인 키와 Team API Key는 사용하지 않습니다.

Individual 키는 연결된 사용자의 앱 접근·역할을 상속합니다. Team 키는 AYR 하나로 제한할 수 없습니다. 키 생성과 초대는 지속적인 계정 접근 권한을 만드는 작업이므로 사용자가 직접 수행하거나 해당 작업을 승인한 뒤 진행합니다. [Apple 키 종류](https://developer.apple.com/documentation/appstoreconnectapi/creating-api-keys-for-app-store-connect-api), [사용자 앱 접근 설정](https://developer.apple.com/help/app-store-connect/manage-your-team/add-and-edit-users/)

## 4. GitHub 설정

저장소 → Settings → Secrets and variables → Actions에서 **Variables**에 다음을 추가합니다.

| Variable | 값 |
| --- | --- |
| `APPLE_TEAM_ID` | Developer 멤버십의 Team ID. |

**Secrets → New repository secret**에는 아래 6개를 추가합니다. 실제 값을 채팅에 보내지 않습니다.

| Secret | 값 |
| --- | --- |
| `APPLE_DISTRIBUTION_P12_BASE64` | 위 `.p12`의 Base64 |
| `APPLE_DISTRIBUTION_P12_PASSWORD` | `.p12` Export Password |
| `APPLE_APP_PROFILE_BASE64` | 앱 `.mobileprovision`의 Base64 |
| `APPLE_WIDGET_PROFILE_BASE64` | 위젯 `.mobileprovision`의 Base64 |
| `ASC_KEY_ID` | AYR 전용 Developer 사용자의 Individual API Key ID |
| `ASC_PRIVATE_KEY_P8_BASE64` | 해당 Individual 키 `.p8`의 Base64 |

Windows에서는 아래 명령의 파일명만 바꿔 Base64를 클립보드로 복사하고 해당 Secret 입력란에 붙여 넣습니다. 화면이나 터미널에 값을 출력하지 않습니다.

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes((Resolve-Path '.\AYR-distribution.p12'))) | Set-Clipboard
```

서명용 Secret 4개와 Team ID만 있으면 IPA 생성까지 가능합니다. 업로드를 켜면 ASC Secret 2개도 필요합니다. Individual 키에는 Issuer ID를 사용하지 않으므로 `ASC_ISSUER_ID`를 추가하지 않습니다. Runner에서는 임시 키체인 암호를 생성하고 성공·실패 시 개인키와 프로파일을 정리합니다. [GitHub 서명 설정 안내](https://docs.github.com/en/actions/how-tos/deploy/deploy-to-third-party-platforms/sign-xcode-applications)

업로드 직전에 Individual JWT(`sub: user`, Issuer ID 없음)로 필터 없는 앱 목록을 조회합니다. 결과가 AYR 하나이고 다음 페이지가 없을 때만 진행하며, 다른 앱·빈 목록·페이지 분할·인증 실패는 업로드를 차단합니다. 사용자 역할은 계정 화면에서 Developer인지 확인해야 합니다. JWT는 Ruby 표준 OpenSSL로 서명하며 앱 목록과 JWT·개인키를 로그에 출력하지 않습니다. [Apple Individual JWT 형식](https://developer.apple.com/documentation/appstoreconnectapi/generating-tokens-for-api-requests)

## 5. 실행과 휴대폰 설치

1. 이 워크플로 파일이 기본 브랜치에 있어야 수동 실행할 수 있습니다. 현재 저장소의 기본 브랜치는 `feat/native-app`이므로 해당 브랜치에 승인받은 변경을 푸시한 뒤 Actions → **TestFlight → Run workflow**에서 선택합니다. 푸시·실행은 사용자의 승인 후 진행합니다. [GitHub 수동 실행 조건](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-running-a-workflow)
2. 처음에는 업로드를 끄고 실행합니다. `checks`와 `archive`가 통과하고 IPA artifact가 생성되는지 확인합니다. 빌드 번호는 `실행 번호.재실행 횟수`이며 최신 실행을 다시 실행해도 겹치지 않습니다. 더 오래된 실행의 재실행은 Apple의 빌드 번호 순서 제한에 걸릴 수 있어 새 실행을 시작합니다.
3. Apple 업로드가 승인되면 새 수동 실행에서 `upload_to_testflight`를 켭니다. 워크플로는 Xcode 26 이상의 설치본으로 archive·export한 뒤, 키의 AYR 접근 범위를 검사하고 Transporter의 JWT 인증으로 verify·upload합니다. 임의의 Issuer ID를 채워 넣는 방식은 사용하지 않습니다. [Apple 업로드 요구 사항](https://developer.apple.com/help/app-store-connect/manage-builds/upload-builds/), [Transporter JWT 인증](https://help.apple.com/itc/transporteruserguide/en.lproj/static.html)
4. Apple 처리 완료 후 App Store Connect → 해당 앱 → TestFlight에서 암호화 수출 규정 질문을 사용자가 확인합니다. 코드에서 답변을 임의 확정하지 않습니다.
5. 내부 테스트 그룹을 만들고 본인 App Store Connect 계정을 추가한 뒤 해당 빌드를 연결합니다. 초대 발송은 사용자 요청·승인 후 진행합니다. iPhone에 TestFlight를 설치하고 초대를 수락해 앱을 설치합니다. [Apple 내부 테스터 안내](https://developer.apple.com/help/app-store-connect/test-a-beta-version/add-internal-testers/)
6. 온보딩 → 가짜 본문 Intent → 오늘·월별 화면 → 잠금화면 위젯·Live Activity를 확인합니다. 실제 문자 검증은 다음 평소 KB 체크카드 결제에서 진행하며 검증만을 위해 결제하지 않습니다.

IPA artifact는 7일 보관합니다. 개인키·프로파일 원본·키체인은 artifact에 포함하지 않습니다. 이 워크플로는 업로드만 수행하며 공개 출시·심사 제출·테스터 자동 초대는 하지 않습니다.
