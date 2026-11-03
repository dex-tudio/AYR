# 님 부자임? — AYR

토스 결제 알림을 자동으로 받아 오늘 쓴 돈과 신분별 문구를 iPhone 잠금화면에 보여주는 개인용 iOS 앱입니다.

```
토스 알림 → 단축어 자동화(본문 전달) → AYR App Intent → 합계·문구 계산 → 위젯·Live Activity
```

## 문서

1. [MVP 확정 명세](docs/mvp-spec.md): 현재 방향, 집계 규칙, 실행 단위.
2. [iPhone 토스 알림 수집 POC](docs/ios-collection-poc.md): 토스 알림 본문이 단축어에 전달되는지 확인하는 절차.
3. [금융 API 검토 기록](docs/financial-api-review.md): 보류한 PWA·금융 API·앱인토스 조사.

## 구조

- `Core/`: 순수 Swift 핵심 로직(합산·취소·날짜 초기화·신분별 문구)과 테스트.

## 검증

```sh
# Docker로 핵심 로직 테스트 (Mac 불필요)
docker run --rm -v "$PWD/Core:/pkg" -w /pkg swift:6.0 swift test
```

GitHub Actions도 push·PR마다 같은 테스트를 실행합니다.

## 상태

- 핵심 로직: 실행 단위 1.
- 앱·위젯·Live Activity·TestFlight 빌드: 아직 없음.
- 토스 알림이 단축어에 전달되는지: 실기기 미검증.
