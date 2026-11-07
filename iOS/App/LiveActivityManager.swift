import ActivityKit
import AYRCore
import Foundation

@MainActor
enum LiveActivityManager {
    static func sync(_ ledger: SpendingLedger) async -> String? {
        guard ledger.onboardingCompleted else { return nil }
        guard ActivityAuthorizationInfo().areActivitiesEnabled else {
            return "잠금화면 표시가 꺼져 있어요. 설정 앱에서 AYR의 실시간 현황(Live Activity)을 켜주세요."
        }
        let now = Date()
        let calendar = spendingCalendar()
        let midnight = calendar.date(byAdding: .day, value: 1, to: calendar.startOfDay(for: now))!
        let state = SpendingActivityAttributes.ContentState(day: ledger.current.day, total: ledger.current.total, budget: ledger.currentBudget)
        let content = ActivityContent(state: state, staleDate: midnight)
        let activities = Activity<SpendingActivityAttributes>.activities
        if let first = activities.first(where: { $0.activityState == .active || $0.activityState == .stale }) {
            await first.update(content)
            for duplicate in activities where duplicate.id != first.id {
                await duplicate.end(nil, dismissalPolicy: .immediate)
            }
        } else {
            do {
                _ = try Activity.request(attributes: SpendingActivityAttributes(), content: content, pushType: nil)
            } catch {
                return "지출은 저장했지만 잠금화면에 띄우지 못했어요. 앱에서 다시 시도해주세요."
            }
        }
        return nil
    }

    static func endAll() async {
        for activity in Activity<SpendingActivityAttributes>.activities {
            await activity.end(nil, dismissalPolicy: .immediate)
        }
    }
}
