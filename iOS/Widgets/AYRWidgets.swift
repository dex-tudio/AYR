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
        }
        .configurationDisplayName("오늘 쓴 돈")
        .description("오늘 쓴 돈과 소비에 대한 한마디를 바로 확인해요.")
        .supportedFamilies([.accessoryInline, .accessoryRectangular, .systemSmall])
    }
}

private struct SpendingWidgetView: View {
    let entry: SpendingEntry
    @Environment(\.widgetFamily) private var family
    @Environment(\.redactionReasons) private var redaction

    // Hidden (locked) state: the mood color would show the band without the words, so it falls back to the plain palette.
    private var hidden: Bool { redaction.contains(.privacy) }

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
                    .foregroundStyle(hidden ? AYRTheme.text : AYRTheme.moodInk)
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
        .containerBackground(for: .widget) {
            // No value (not started, unreadable) or hidden keeps the plain background.
            if let total = entry.total, !hidden {
                AYRTheme.mood(total: total, budget: entry.budget)
            } else {
                AYRTheme.background
            }
        }
    }
}

private struct SpendingLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: SpendingActivityAttributes.self) { context in
            // The tint stays plain: the mood color is painted by the content view, which can see whether the text is hidden.
            SpendingActivityView(state: context.state, isStale: context.isStale)
                .activityBackgroundTint(AYRTheme.background)
                .activitySystemActionForegroundColor(AYRTheme.text)
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
}

private struct SpendingActivityView: View {
    let state: SpendingActivityAttributes.ContentState
    let isStale: Bool
    @Environment(\.redactionReasons) private var redaction

    var body: some View {
        let expired = isStale || state.day != dayKey(for: Date())
        let total = expired ? 0 : state.total
        // Expired and hidden (locked) keep the plain palette and no critter: not today's amount, or not to be shown.
        let plain = expired || redaction.contains(.privacy)
        let ink = plain ? AYRTheme.text : AYRTheme.moodInk
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("AYR / 오늘 쓴 돈").font(.caption.bold())
                Spacer()
                Image(systemName: "asterisk").accessibilityHidden(true)
            }
            .foregroundStyle(plain ? AYRTheme.accent : ink)
            HStack(spacing: 12) {
                if !plain { CritterBadge(total: total, budget: state.budget) }
                VStack(alignment: .leading, spacing: 4) {
                    Text(expired ? "날짜가 바뀌었어요 · 앱에서 새로고침" : phrase(total: total, budget: state.budget))
                        .font(.custom(AYRTheme.display, size: expired ? 16 : 26, relativeTo: expired ? .callout : .title2))
                        .lineLimit(expired ? 2 : 1).minimumScaleFactor(0.6)
                        .fixedSize(horizontal: false, vertical: true)
                    Text(money(total))
                        .font(.system(.title2, design: .rounded, weight: .black))
                        .monospacedDigit().lineLimit(1).minimumScaleFactor(0.4)
                    if !expired {
                        Text("하루 기준 \(money(state.budget))")
                            .font(.caption)
                            .lineLimit(1).minimumScaleFactor(0.6)
                    }
                }
            }
        }
        .foregroundStyle(ink)
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        // The Live Activity has a fixed height (160pt). At .large the lines are: caption 16 + 8 + critter 56 or (phrase ~32 + 4 + title2 ~28 + 4 + caption 16 = 84) + 24 padding = about 132pt;
        // larger sizes would push the last line out.
        .dynamicTypeSize(...DynamicTypeSize.large)
        .background(plain ? AYRTheme.background : AYRTheme.mood(total: total, budget: state.budget))
        .privacySensitive()
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
