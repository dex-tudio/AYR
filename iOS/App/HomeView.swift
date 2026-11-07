import SwiftUI
import AYRCore

struct HomeView: View {
    @EnvironmentObject private var model: AppModel
    @ScaledMetric(relativeTo: .largeTitle) private var amountSize = 52

    var body: some View {
        ScrollView {
            if let ledger = model.ledger {
                VStack(alignment: .leading, spacing: 20) {
                    VStack(alignment: .leading, spacing: 12) {
                        Text(Date(), format: .dateTime.month().day().weekday())
                            .font(.subheadline).foregroundStyle(.secondary)
                        HStack {
                            Text("오늘 쓴 돈").font(.headline)
                                .padding(.horizontal, 12).padding(.vertical, 6)
                                .foregroundStyle(AYRTheme.ink)
                                .background(AYRTheme.lime, in: Capsule())
                            Spacer()
                            Image(systemName: "asterisk").font(.title.bold()).accessibilityHidden(true)
                        }
                        Text(money(ledger.current.total))
                            .font(.system(size: amountSize, weight: .black, design: .rounded))
                            .monospacedDigit()
                            .padding(.vertical, 8)
                            .lineLimit(1).minimumScaleFactor(0.4)
                        Text(phrase(total: ledger.current.total, budget: ledger.currentBudget))
                            .font(.system(.title, design: .rounded, weight: .black))
                            .foregroundStyle(spendingColor(total: ledger.current.total, budget: ledger.currentBudget))
                        Text("\(ledger.settings.identity.title) · 오늘 기준 \(money(ledger.currentBudget))")
                            .font(.subheadline).foregroundStyle(.secondary)
                        if ledger.currentBudget != ledger.settings.dailyBudget {
                            Text("이 날짜에는 당시 기준을 사용해요. 바꾼 기준은 새로 기록하는 날짜부터 적용돼요.")
                                .font(.footnote).foregroundStyle(.secondary)
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(24)
                    .background(AYRTheme.surface, in: RoundedRectangle(cornerRadius: 24))
                    .overlay(alignment: .topLeading) {
                        Capsule().fill(AYRTheme.lime).frame(width: 48, height: 5)
                            .padding(.leading, 24)
                    }

                    NavigationLink {
                        TodaySpendingView()
                    } label: {
                        HStack {
                            Label("오늘 지출 살펴보기", systemImage: "list.bullet.rectangle")
                            Spacer()
                            Image(systemName: "arrow.up.right")
                        }
                        .font(.headline)
                        .frame(minHeight: 44)
                        .ayrCard()
                    }
                    .buttonStyle(.plain)

                    VStack(alignment: .leading, spacing: 12) {
                        Label("문자가 오면, 알아서", systemImage: "bolt.horizontal.circle")
                            .font(.headline)
                        Text("KB국민 체크카드 문자를 연결하면 오늘 쓴 돈에 자동으로 더해져요.")
                        ReceptionStatusView(ledger: ledger)
                        NavigationLink { ConnectionView() } label: {
                            Label("결제 문자 연결하기", systemImage: "arrow.up.right")
                                .frame(minHeight: 44)
                        }
                    }
                    .ayrCard()

                    VStack(alignment: .leading, spacing: 12) {
                        Label("잠금화면에서도 바로", systemImage: "lock.rectangle")
                            .font(.headline)
                        Text("잠금화면을 길게 눌러 사용자화 → 위젯 추가 → AYR을 선택하세요.")
                        Button("잠금화면에서 보기") {
                            Task { await model.refreshActivity() }
                        }
                        .buttonStyle(AYRPrimaryButtonStyle())
                        if let notice = model.activityNotice {
                            Text(notice).font(.footnote).foregroundStyle(.secondary)
                        }
                        Text("이 버튼으로 띄운 표시는 일정 시간이 지나면 사라져요. 앱을 열거나 다음 결제 문자가 도착하면 다시 시작해요.")
                            .font(.footnote).foregroundStyle(.secondary)
                    }
                    .ayrCard()

                    Text("같은 문자가 다시 오면 두 번 더해질 수 있어요. KB 결제 취소는 아직 반영되지 않아요. 자동화가 꺼져 있을 때 놓친 결제는 나중에 불러올 수 없어요.")
                        .font(.footnote).foregroundStyle(.secondary)
                }
                .padding(20)
            }
        }
        .ayrScreen()
        .navigationTitle("님 부자임?")
        .refreshable { await model.refreshActivity() }
    }
}
