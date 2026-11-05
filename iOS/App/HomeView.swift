import SwiftUI
import AYRCore

struct HomeView: View {
    @EnvironmentObject private var model: AppModel

    var body: some View {
        ScrollView {
            if let ledger = model.ledger {
                VStack(alignment: .leading, spacing: 24) {
                    VStack(alignment: .leading, spacing: 12) {
                        Text(Date(), format: .dateTime.month().day().weekday())
                            .font(.subheadline).foregroundStyle(.secondary)
                        Text("오늘 쓴 돈").font(.headline)
                        Text(money(ledger.current.total))
                            .font(.system(.largeTitle, design: .rounded, weight: .bold))
                            .lineLimit(1).minimumScaleFactor(0.4)
                        Text(phrase(total: ledger.current.total, budget: ledger.currentBudget))
                            .font(.title2.bold())
                            .foregroundStyle(spendingColor(total: ledger.current.total, budget: ledger.currentBudget))
                        Text("\(ledger.settings.identity.title) · 오늘 기준 \(money(ledger.currentBudget))")
                            .font(.subheadline).foregroundStyle(.secondary)
                        if ledger.currentBudget != ledger.settings.dailyBudget {
                            Text("보관된 날짜의 원래 기준을 유지하고 있어요. 새 기준은 새로 기록하는 날짜에 적용합니다.")
                                .font(.footnote).foregroundStyle(.secondary)
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(24)
                    .background(.indigo.opacity(0.08), in: RoundedRectangle(cornerRadius: 24))

                    NavigationLink {
                        TodaySpendingView()
                    } label: {
                        Label("오늘 지출 추가·삭제", systemImage: "list.bullet.rectangle")
                    }
                    .buttonStyle(.bordered)

                    VStack(alignment: .leading, spacing: 12) {
                        Label("결제 문자와 연결", systemImage: "bolt.horizontal.circle")
                            .font(.headline)
                        Text("KB국민 체크카드 문자를 단축어 자동화로 전달하면 합계가 바뀝니다.")
                        if let date = ledger.lastReception {
                            Text("마지막 수신(테스트 포함): \(date.formatted(date: .abbreviated, time: .shortened))")
                                .font(.footnote).foregroundStyle(.secondary)
                        } else {
                            Text("아직 수신을 확인하지 못했어요.")
                                .foregroundStyle(.secondary)
                        }
                        NavigationLink("자동화 설정·수신 테스트") { ConnectionView() }
                    }

                    VStack(alignment: .leading, spacing: 12) {
                        Label("잠금화면에서도 바로", systemImage: "lock.rectangle")
                            .font(.headline)
                        Text("잠금화면을 길게 눌러 사용자화 → 위젯 추가 → AYR을 선택하세요.")
                        Button("Live Activity 시작·새로고침") {
                            Task { await model.refreshActivity() }
                        }
                        .buttonStyle(.borderedProminent)
                        if let notice = model.activityNotice {
                            Text(notice).font(.footnote).foregroundStyle(.secondary)
                        }
                        Text("Live Activity는 계속 고정되지 않습니다. 종료되면 앱 실행이나 다음 결제 처리 때 다시 시작합니다.")
                            .font(.footnote).foregroundStyle(.secondary)
                    }

                    Text("동일 문자가 중복 수신되면 두 번 합산될 수 있습니다. KB 취소 문자는 형식 확인 전까지 반영하지 않습니다. 자동화가 꺼져 있던 동안의 결제는 복구되지 않습니다.")
                        .font(.footnote).foregroundStyle(.secondary)
                }
                .padding()
            }
        }
        .navigationTitle("님 부자임?")
        .refreshable { await model.refreshActivity() }
    }
}
