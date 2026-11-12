# 님 부자임? — AYR

KB국민 체크카드 결제 문자를 단축어로 받아 오늘 쓴 돈과 신분별 문구를 iPhone 잠금화면에 보여주는 iOS 앱 POC입니다.

```
KB 결제 문자 → 단축어 자동화(본문 전달) → AYR App Intent → 합계·문구 계산 → 위젯·Live Activity
```

## 문서

1. [MVP 확정 명세](docs/mvp-spec.md): 현재 방향, 집계 규칙, 실행 단위.
2. [POC 검증 기록](docs/poc-results.md): 자동 검증 결과와 실기기 미검증 항목.
3. [이전 토스 알림 수집 POC](docs/ios-collection-poc.md): 현재 지원 대상이 아닌 토스의 조사 기록.
4. [금융 API 검토 기록](docs/financial-api-review.md): 보류한 PWA·금융 API·앱인토스 조사.
5. [TestFlight 준비와 GitHub 설정](docs/testflight.md): Windows에서 인증서·프로파일·Secrets 준비, 수동 빌드·업로드, 본인 iPhone 설치 순서.
6. [결제 알림 템플릿·단축어 연결 조사](docs/payment-notification-research.md): 주요 은행·카드사·카카오페이·네이버페이의 알림 경로, 확보한 형식과 미확인 항목.
7. [카카오페이·Npay 앱 알림 설계](docs/pay-app-notification-design.md): 공통 자동화 템플릿, 기존 문자 호환성, 구현 전 확인할 입력·중복 수집 정책.

## 구조

- `Core/`: 순수 Swift 핵심 로직(합산·취소·날짜 초기화·신분별 문구)과 테스트.
- `app/`, `src/`: React Native/Expo Router의 오늘·월별·설정·온보딩 화면과 상태. 브라우저 미리보기는 가짜 기록 전용입니다.
- `iOS/App/`: RN SwiftUI 호스트, `AYRNative` 브릿지, AppModel, 고정 App Intent `AYR 결제 처리`.
- `iOS/Shared/`: App Group 파일 저장소와 Live Activity 데이터. 원문·가게 이름은 저장하지 않습니다.
- `iOS/Widgets/`: 잠금화면·홈 화면 위젯, Live Activity·Dynamic Island.
- `project.yml`, `Podfile`: 최소 iOS 17. XcodeGen → CocoaPods → `AYR.xcworkspace`. 위젯은 RN/Expo 없이 기본 프레임워크를 사용합니다.

## Windows 화면 미리보기

Node 22.18.0에서 PowerShell로 실행합니다.

```powershell
npm ci
npm run web
```

터미널에 표시되는 `http://localhost:8081`을 엽니다(포트 사용 중이면 표시된 주소를 사용). `미리보기 · 가짜 기록` 도구에서 시나리오를 고르고 `다시 시작` 또는 브라우저 새로고침으로 초기화합니다. 기준일은 가짜 날짜 `2026-11-11`입니다. 실제 장부·문자에 접근하지 않고 브라우저 저장소에도 남기지 않습니다. 온보딩·추가/삭제·월별·설정·실패와 복구·잠금화면 디자인을 앱 설치 없이 확인할 수 있습니다. `npm run test:web`은 export된 화면을 `http://127.0.0.1:4173`에서 자동 검사합니다.

실제 Intent·문자 자동화·위젯 설치·Live Activity·기기 권한은 iOS 전용 앱 빌드에서 확인합니다. Expo Go에는 `AYRNative`가 없어 실행할 수 없습니다. Swift/Podfile/네이티브 모듈 변경에는 macOS에서 앱을 다시 빌드해야 합니다. Release 앱은 JS와 자산을 내장하며 Metro 없이 시작합니다.

Swift가 실제 장부·금액 검증·현지 양력 날짜·문구·월 집계를 담당하고 RN은 반환값을 표시합니다. 최대 금액이 JS 안전 정수보다 커 모든 금액을 10진 문자열로 전달하며, 웹 가짜 계산·표시는 BigInt를 씁니다. 문자 본문은 Swift Intent 안에서 처리하고 JS로 전달하지 않습니다.

## 검증

```sh
# Docker로 핵심 로직 테스트 (Mac 불필요)
docker run --rm -v "$PWD/Core:/pkg" -w /pkg swift:6.0 swift test
# 저장 실패·동시 수신·날짜 정리 검사
docker run --rm -v "$PWD:/repo" -w /repo swift:6.0 bash scripts/check-storage.sh
# 손상된 원본 보존·초기화·권한 실패 검사
docker run --rm -v "$PWD:/repo" -w /repo swift:6.0 bash scripts/check-recovery.sh
# 공통 금액 입력·표시 검사와 iOS Swift 문법 검사
docker run --rm -v "$PWD:/repo" -w /repo swift:6.0 bash scripts/check-ios.sh
```

PowerShell에서는 볼륨 경로를 `"${PWD}/Core:/pkg"`, `"${PWD}:/repo"`로 씁니다. GitHub Actions는 push·PR마다 같은 검사와 macOS 시뮬레이터 빌드를 실행합니다. QA 정책 변경과 확정 식별자·아이콘을 포함한 `a74eb0b`의 자동 검사 80개·앱·위젯 빌드는 [CI에서 통과했습니다](https://github.com/dex-tudio/AYR/actions/runs/42214783420).

Mac에서 프로젝트 생성·서명 없는 빌드:

```sh
npm ci
bash scripts/prepare-ios.sh
xcodebuild -workspace AYR.xcworkspace -scheme AYR -configuration Debug -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO build
```

`package-lock.json`과 `Podfile.lock`을 고정합니다. 첫 macOS CI는 명시적으로 Pods를 해석해 `ios-pod-lock-<SHA>` artifact를 남깁니다. 그 lock을 검토·커밋한 SHA의 CI를 다시 통과해야 전환 검증이 끝납니다. 이후 `prepare-ios.sh`는 `pod install --deployment`만 허용하고, 서명 워크플로는 lock이 없으면 중단합니다. Debug/Release 앱·위젯 빌드, Release `main.jsbundle`·위젯 확장 포함, Release simulator RN→Swift snapshot smoke는 macOS CI 관문이며 Windows 검사로 대체하지 않습니다.

앱 Bundle ID는 `com.codemaker-kim.ayr`, 위젯은 `com.codemaker-kim.ayr.widgets`, App Group은 `group.com.codemaker-kim.ayr.shared`로 맞췄습니다(`project.yml`, `iOS/metadata/*.entitlements`, `iOS/Shared/SpendingStore.swift`). POC용 1024px 앱 아이콘을 추가했습니다. Apple 계정에 앱·위젯 ID와 App Group을 등록·연결하고 App Store Connect 앱을 생성했습니다. 배포 인증서·프로파일과 Secrets를 등록하고 첫 빌드를 TestFlight에 업로드했습니다.

## 상태

- 코드 구현: 핵심 로직·저장·앱·온보딩·월별·위젯·Live Activity. QA 정책에 따라 과거 월 예산 보존, 호출 실패 표시, 손상 파일 복구, 복원 합계 보호를 추가했습니다.
- 실행 검증: Core 50개, 저장소 검사 15개, 복구 검사 12개, 공통 금액 입력·표시 검사 3개와 앱·위젯의 Apple SDK 빌드 통과. TestFlight 스크립트의 모의 검사 9개 통과(실제 Apple API·도구 실행은 대체).
- TestFlight: 수동 archive·export·선택적 업로드 워크플로 준비. Developer 역할의 Team API Key로 빌드 `0.1.0 (3.1)` 업로드와 Apple 처리를 확인했고, 내부 테스터를 초대했습니다.
- 미검증: 휴대폰 설치·화면·문자 자동 수신·잠금화면 동작.
