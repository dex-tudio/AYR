import ActivityKit
import AYRCore
import SwiftUI
import WidgetKit

@main
struct AYRWidgets: WidgetBundle {
    var body: some Widget {
        SpendingWidget()
        SpendingLiveActivity()
    }
}

private struct SpendingEntry: TimelineEntry {
    let date: Date
    let total: Int?
    let budget: Int
    let message: String?
}

private struct SpendingProvider: TimelineProvider {
    func placeholder(in context: Context) -> SpendingEntry {
        SpendingEntry(date: Date(), total: 0, budget: 20_000, message: nil)
    }

    func getSnapshot(in context: Context, completion: @escaping (SpendingEntry) -> Void) {
        completion(context.isPreview ? placeholder(in: context) : entry(at: Date()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<SpendingEntry>) -> Void) {
        let now = Date()
        let current = entry(at: now)
        let calendar = spendingCalendar()
        let midnight = calendar.date(byAdding: .day, value: 1, to: calendar.startOfDay(for: now))!
        let next = SpendingEntry(date: midnight, total: current.total.map { _ in 0 }, budget: current.budget, message: current.message)
        completion(Timeline(entries: [current, next], policy: .atEnd))
    }

    private func entry(at date: Date) -> SpendingEntry {
        do {
            let ledger = try SpendingStore().read(now: date)
            guard ledger.onboardingCompleted else {
                return SpendingEntry(date: date, total: nil, budget: ledger.settings.dailyBudget, message: "AYR에서 초기 설정")
            }
            return SpendingEntry(date: date, total: ledger.current.total, budget: ledger.settings.dailyBudget, message: nil)
        } catch {
            return SpendingEntry(date: date, total: nil, budget: 20_000, message: "앱에서 기록 확인")
        }
    }
}

private struct SpendingWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "AYRSpending", provider: SpendingProvider()) { entry in
            SpendingWidgetView(entry: entry)
                .containerBackground(.fill.tertiary, for: .widget)
        }
        .configurationDisplayName("오늘 쓴 돈")
        .description("오늘 지출과 생활 기준에 맞는 문구를 보여줍니다.")
        .supportedFamilies([.accessoryInline, .accessoryRectangular, .systemSmall])
    }
}

private struct SpendingWidgetView: View {
    let entry: SpendingEntry
    @Environment(\.widgetFamily) private var family

    var body: some View {
        Group {
            if let total = entry.total {
                if family == .accessoryInline {
                    Text("오늘 \(money(total)) · \(phrase(total: total, budget: entry.budget))")
                } else {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("오늘 \(money(total))").font(.headline).minimumScaleFactor(0.4).lineLimit(1)
                        Text(phrase(total: total, budget: entry.budget))
                            .font(.caption).fixedSize(horizontal: false, vertical: true)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
            } else {
                Label(entry.message ?? "앱에서 기록 확인", systemImage: "exclamationmark.circle")
                    .font(.caption)
            }
        }
        .privacySensitive()
    }
}

private struct SpendingLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: SpendingActivityAttributes.self) { context in
            let expired = context.isStale || context.state.day != dayKey(for: Date())
            let total = expired ? 0 : context.state.total
            VStack(alignment: .leading, spacing: 6) {
                Text("오늘 \(money(total))")
                    .font(.title2.bold()).lineLimit(1).minimumScaleFactor(0.4)
                Text(expired ? "날짜가 바뀌었어요 · 앱에서 새로고침" : phrase(total: total, budget: context.state.budget))
                    .font(.subheadline)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding()
            .activityBackgroundTint(.indigo.opacity(0.12))
            .activitySystemActionForegroundColor(.primary)
            .privacySensitive()
        } dynamicIsland: { context in
            let expired = context.isStale || context.state.day != dayKey(for: Date())
            let total = expired ? 0 : context.state.total
            return DynamicIsland {
                DynamicIslandExpandedRegion(.leading) { Label("오늘", systemImage: "creditcard") }
                DynamicIslandExpandedRegion(.trailing) {
                    Text(money(total)).bold().lineLimit(1).minimumScaleFactor(0.4)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    Text(expired ? "앱에서 새로고침" : phrase(total: total, budget: context.state.budget))
                }
            } compactLeading: {
                Image(systemName: "creditcard")
            } compactTrailing: {
                Text(money(total)).font(.caption2).lineLimit(1).minimumScaleFactor(0.3)
            } minimal: {
                Image(systemName: "creditcard")
            }
        }
    }
}
