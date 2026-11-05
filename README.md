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

## 구조

- `Core/`: 순수 Swift 핵심 로직(합산·취소·날짜 초기화·신분별 문구)과 테스트.
- `iOS/App/`: 오늘·월별·설정 화면, 당일 지출 추가·삭제, 온보딩 5단계, 고정 App Intent `AYR 결제 처리`.
- `iOS/Shared/`: App Group 파일 저장소와 Live Activity 데이터. 원문·가게 이름은 저장하지 않습니다.
- `iOS/Widgets/`: 잠금화면·홈 화면 위젯, Live Activity·Dynamic Island.
- `project.yml`: XcodeGen 프로젝트 정의. 최소 iOS 17, 외부 라이브러리 없이 iOS 기본 프레임워크 사용.

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

PowerShell에서는 볼륨 경로를 `"${PWD}/Core:/pkg"`, `"${PWD}:/repo"`로 씁니다. GitHub Actions는 push·PR마다 같은 검사와 macOS 시뮬레이터 빌드를 실행하도록 설정했습니다. 이전 커밋 `f00c142`의 앱·위젯 빌드는 CI에서 통과했으며, 이번 QA 정책 변경은 아직 푸시하지 않았습니다.

Mac에서 프로젝트 생성·서명 없는 빌드:

```sh
xcodegen generate
xcodebuild -project AYR.xcodeproj -scheme AYR -configuration Debug -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO build
```

TestFlight 준비 시 `dev.ayr.app`, `dev.ayr.app.widgets`, `group.dev.ayr.shared`를 본인 소유 식별자로 함께 교체해야 합니다(`project.yml`, `iOS/metadata/*.entitlements`, `iOS/Shared/SpendingStore.swift`). 서명·App Store Connect·키 등록·업로드는 아직 구성하지 않았습니다.

## 상태

- 코드 구현: 핵심 로직·저장·앱·온보딩·월별·위젯·Live Activity. QA 정책에 따라 과거 월 예산 보존, 호출 실패 표시, 손상 파일 복구, 복원 합계 보호를 추가했습니다.
- 실행 검증: Docker Swift 6에서 Core 50개, 저장소 검사 15개, 복구 검사 12개, 공통 금액 입력·표시 검사 3개 통과. iOS 소스 문법 검사 통과.
- 미검증: QA 정책 변경분의 Apple SDK 빌드·실제 화면·문자 자동 수신·잠금화면 동작. TestFlight 테스트는 POC 구현 다음 단계입니다.
