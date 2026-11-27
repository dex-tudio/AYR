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
    let nextBudget: Int
    let message: String?
}

private struct SpendingProvider: TimelineProvider {
    func placeholder(in context: Context) -> SpendingEntry {
        SpendingEntry(date: Date(), total: 0, budget: 20_000, nextBudget: 20_000, message: nil)
    }

    func getSnapshot(in context: Context, completion: @escaping (SpendingEntry) -> Void) {
        completion(context.isPreview ? placeholder(in: context) : entry(at: Date()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<SpendingEntry>) -> Void) {
        let now = Date()
        let current = entry(at: now)
        let calendar = spendingCalendar()
        let midnight = calendar.date(byAdding: .day, value: 1, to: calendar.startOfDay(for: now))!
        let next = SpendingEntry(date: midnight, total: current.total.map { _ in 0 }, budget: current.nextBudget, nextBudget: current.nextBudget, message: current.message)
        completion(Timeline(entries: [current, next], policy: .atEnd))
    }

    private func entry(at date: Date) -> SpendingEntry {
        do {
            let ledger = try SpendingStore().read(now: date)
            guard ledger.onboardingCompleted else {
                return SpendingEntry(date: date, total: nil, budget: ledger.settings.dailyBudget, nextBudget: ledger.settings.dailyBudget, message: "AYR에서 시작하기")
            }
            return SpendingEntry(date: date, total: ledger.current.total, budget: ledger.currentBudget, nextBudget: ledger.settings.dailyBudget, message: nil)
        } catch {
            return SpendingEntry(date: date, total: nil, budget: 20_000, nextBudget: 20_000, message: "앱에서 기록 확인")
        }
    }
}

private struct SpendingWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "AYRSpending", provider: SpendingProvider()) { entry in
            SpendingWidgetView(entry: entry)
                .containerBackground(for: .widget) {
                    // No value (not started, unreadable) keeps the plain background.
                    entry.total.map { AYRTheme.mood(total: $0, budget: entry.budget) } ?? AYRTheme.background
                }
        }
        .configurationDisplayName("오늘 쓴 돈")
        .description("오늘 쓴 돈과 소비에 대한 한마디를 바로 확인해요.")
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
                        .font(.custom(AYRTheme.display, size: 14, relativeTo: .body))
                } else if family == .systemSmall {
                    // Amount first, then the phrase, then the base it is judged against.
                    VStack(alignment: .leading, spacing: 6) {
                        HStack {
                            Text("AYR / 오늘").font(.caption.bold())
                            Spacer()
                            Image(systemName: "asterisk").accessibilityHidden(true)
                        }
                        Text(money(total))
                            .font(.system(.title, design: .rounded, weight: .black))
                            .monospacedDigit().lineLimit(1).minimumScaleFactor(0.4)
                        Text(phrase(total: total, budget: entry.budget))
                            .font(.custom(AYRTheme.display, size: 17, relativeTo: .subheadline))
                            .fixedSize(horizontal: false, vertical: true)
                        Spacer(minLength: 0)
                        Text("하루 기준 \(money(entry.budget))")
                            .font(.caption)
                            .lineLimit(1).minimumScaleFactor(0.6)
                    }
                    // The mood background carries the band; the ink is one color so the words stay readable on all three.
                    .foregroundStyle(AYRTheme.moodInk)
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                    .accessibilityElement(children: .combine)
                } else {
                    // Lock screen: the system tints this, so it carries no color of its own.
                    VStack(alignment: .leading, spacing: 2) {
                        // caption2 (11pt) on purpose: the rectangular lock-screen widget has room for three short lines only.
                        Text("오늘").font(.caption2)
                        Text(money(total)).font(.headline).minimumScaleFactor(0.4).lineLimit(1).widgetAccentable()
                        Text(phrase(total: total, budget: entry.budget))
                            .font(.custom(AYRTheme.display, size: 12, relativeTo: .caption))
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .accessibilityElement(children: .combine)
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
            // Expired keeps the plain background and no critter: it is not today's amount any more.
            let ink = expired ? AYRTheme.text : AYRTheme.moodInk
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Text("AYR / 오늘 쓴 돈").font(.caption.bold())
                    Spacer()
                    Image(systemName: "asterisk").accessibilityHidden(true)
                }
                .foregroundStyle(expired ? AYRTheme.accent : ink)
                HStack(spacing: 12) {
                    if !expired { CritterBadge(total: total, budget: context.state.budget) }
                    VStack(alignment: .leading, spacing: 4) {
                        activityMessage(expired: expired, total: total, budget: context.state.budget)
                        activityAmount(total)
                        if !expired {
                            Text("하루 기준 \(money(context.state.budget))")
                                .font(.caption)
                                .lineLimit(1).minimumScaleFactor(0.6)
                        }
                    }
                }
            }
            .foregroundStyle(ink)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding()
            // The Live Activity has a fixed height for four lines; the largest standard text size keeps the last line from being cut off.
            .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
            .activityBackgroundTint(expired ? AYRTheme.background : AYRTheme.mood(total: total, budget: context.state.budget))
            .activitySystemActionForegroundColor(ink)
            .privacySensitive()
        } dynamicIsland: { context in
            let expired = context.isStale || context.state.day != dayKey(for: Date())
            let total = expired ? 0 : context.state.total
            return DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Label("오늘", systemImage: "creditcard").foregroundStyle(AYRTheme.wallet)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Text(money(total)).bold().lineLimit(1).minimumScaleFactor(0.4)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    Text(expired ? "앱에서 새로고침" : phrase(total: total, budget: context.state.budget))
                }
            } compactLeading: {
                Image(systemName: "creditcard").foregroundStyle(AYRTheme.wallet)
            } compactTrailing: {
                Text(money(total)).font(.caption2).lineLimit(1).minimumScaleFactor(0.3)
                    .accessibilityLabel("오늘 쓴 돈 \(money(total))")
            } minimal: {
                Image(systemName: "creditcard").foregroundStyle(AYRTheme.wallet)
                    .accessibilityLabel("오늘 쓴 돈")
            }
        }
    }

    private func activityAmount(_ total: Int) -> some View {
        Text(money(total))
            .font(.system(.title2, design: .rounded, weight: .black))
            .monospacedDigit().lineLimit(1).minimumScaleFactor(0.4)
    }

    private func activityMessage(expired: Bool, total: Int, budget: Int) -> some View {
        Text(expired ? "날짜가 바뀌었어요 · 앱에서 새로고침" : phrase(total: total, budget: budget))
            .font(.custom(AYRTheme.display, size: expired ? 16 : 26, relativeTo: expired ? .callout : .title2))
            .lineLimit(2).minimumScaleFactor(0.6)
            .fixedSize(horizontal: false, vertical: true)
    }
}

#Preview("오늘 지출", as: .systemSmall) {
    SpendingWidget()
} timeline: {
    SpendingEntry(date: .now, total: 0, budget: 20_000, nextBudget: 20_000, message: nil)
    SpendingEntry(date: .now, total: 15_000, budget: 20_000, nextBudget: 20_000, message: nil)
    SpendingEntry(date: .now, total: maximumMoney, budget: 20_000, nextBudget: 20_000, message: nil)
    SpendingEntry(date: .now, total: nil, budget: 20_000, nextBudget: 20_000, message: "앱에서 기록 확인")
}

#Preview("잠금화면", as: .accessoryRectangular) {
    SpendingWidget()
} timeline: {
    SpendingEntry(date: .now, total: 15_000, budget: 20_000, nextBudget: 20_000, message: nil)
    SpendingEntry(date: .now, total: nil, budget: 20_000, nextBudget: 20_000, message: "AYR에서 시작하기")
}

#Preview("Live Activity", as: .content, using: SpendingActivityAttributes()) {
    SpendingLiveActivity()
} contentStates: {
    SpendingActivityAttributes.ContentState(day: dayKey(for: .now), total: 15_000, budget: 20_000)
    SpendingActivityAttributes.ContentState(day: dayKey(for: .now), total: maximumMoney, budget: 20_000)
    SpendingActivityAttributes.ContentState(day: "2000-01-01", total: 15_000, budget: 20_000)
}
