import SwiftUI
import AYRCore

struct MonthlyView: View {
    @EnvironmentObject private var model: AppModel
    @State private var offset = 0
    private var calendar: Calendar { spendingCalendar() }
    private let columns = Array(repeating: GridItem(.flexible(), spacing: 3), count: 7)

    private var month: Date {
        let start = calendar.dateInterval(of: .month, for: Date())!.start
        return calendar.date(byAdding: .month, value: offset, to: start)!
    }

    var body: some View {
        ScrollView {
            if let ledger = model.ledger {
                let summary = ledger.summary(for: month)
                VStack(alignment: .leading, spacing: 20) {
                    monthNavigation
                    summaryCard(summary)
                    calendarGrid(summary.days)
                        .ayrCard()

                    VStack(alignment: .leading, spacing: 12) {
                        Text("어떤 날들이었나요?").font(.headline)
                        ForEach(["아직 여유 있어요", "슬슬 조절해볼까요?", "님 부자임?"], id: \.self) { phrase in
                            HStack {
                                Text(phrase)
                                Spacer()
                                Text("\(summary.phraseCounts[phrase, default: 0])일").bold().monospacedDigit()
                            }
                        }
                    }
                    .ayrCard()
                    Text("기록 시작 전의 빈 날짜와 미래 날짜는 기록 없음으로 표시합니다. 이후 결제가 없는 날은 0원이며, 자동화 중단으로 놓친 날과 구분할 수 없습니다. 최근 12개월만 보관합니다.")
                        .font(.footnote).foregroundStyle(.secondary)
                }
                .padding(20)
            }
        }
        .ayrScreen()
        .navigationTitle("월별 지출")
    }

    private var monthNavigation: some View {
        HStack {
            Button { offset -= 1 } label: { Image(systemName: "chevron.left").frame(minWidth: 44, minHeight: 44) }
                .disabled(offset <= -11).accessibilityLabel("이전 달")
            Spacer()
            Text(month, format: .dateTime.year().month()).font(.title2.bold())
            Spacer()
            Button { offset += 1 } label: { Image(systemName: "chevron.right").frame(minWidth: 44, minHeight: 44) }
                .disabled(offset >= 0).accessibilityLabel("다음 달")
        }
    }

    private func summaryCard(_ summary: MonthSummary) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("월 합계").font(.headline)
            Text(money(summary.total))
                .font(.system(.largeTitle, design: .rounded, weight: .black))
                .monospacedDigit().lineLimit(1).minimumScaleFactor(0.4)
            Text("예산 \(money(summary.budget))")
            Text(summary.remaining >= 0 ? "\(money(summary.remaining)) 남았어요" : "\(money(-summary.remaining)) 초과")
                .foregroundStyle(summary.remaining >= 0 ? AYRTheme.calm : AYRTheme.exceeded)
            if let difference = summary.comparison {
                Text(comparisonText(difference))
                    .font(.subheadline).foregroundStyle(.secondary)
            } else {
                Text("지난달 비교 기록이 없어요.")
                    .font(.subheadline).foregroundStyle(.secondary)
            }
        }
        .ayrCard()
        .overlay(alignment: .topLeading) {
            Capsule().fill(AYRTheme.lime).frame(width: 48, height: 5).padding(.leading, 20)
        }
    }

    private func calendarGrid(_ days: [MonthDay]) -> some View {
        LazyVGrid(columns: columns, spacing: 8) {
            ForEach(0..<7, id: \.self) { index in
                let symbol = calendar.veryShortStandaloneWeekdaySymbols[(calendar.firstWeekday - 1 + index) % 7]
                Text(symbol).font(.caption).foregroundStyle(.secondary)
            }
            let padding = (calendar.component(.weekday, from: month) - calendar.firstWeekday + 7) % 7
            ForEach(0..<padding, id: \.self) { _ in Color.clear.frame(height: 60) }
            ForEach(days) { day in
                dayCell(day)
            }
        }
    }

    private func dayCell(_ day: MonthDay) -> some View {
        let color: Color
        let status: String
        if let total = day.total, let budget = day.budget {
            color = spendingColor(total: total, budget: budget).opacity(0.15)
            status = phrase(total: total, budget: budget)
        } else {
            color = Color.secondary.opacity(0.05)
            status = ""
        }
        return VStack(spacing: 5) {
            Text("\(calendar.component(.day, from: day.date))").font(.caption.bold())
            if let total = day.total {
                Text(total.formatted(.number)).font(.caption2)
                    .lineLimit(1).minimumScaleFactor(0.3)
            } else {
                Text("—").font(.caption2).foregroundStyle(.secondary)
            }
        }
        .frame(maxWidth: .infinity, minHeight: 60)
        .padding(.horizontal, 2)
        .background(RoundedRectangle(cornerRadius: 8).fill(color))
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(day.date.formatted(date: .abbreviated, time: .omitted) + ", " + (day.total.map(money) ?? "기록 없음") + ", " + status)
    }

    private func comparisonText(_ difference: Int) -> String {
        if difference > 0 { return "지난달 같은 기간보다 \(money(difference)) 더 썼어요." }
        if difference < 0 { return "지난달 같은 기간보다 \(money(-difference)) 덜 썼어요." }
        return "지난달 같은 기간과 같아요."
    }
}
