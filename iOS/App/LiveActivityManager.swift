import ActivityKit
import AYRCore
import Foundation

@MainActor
enum LiveActivityManager {
    static func sync(_ ledger: SpendingLedger) async -> String? {
        guard ledger.onboardingCompleted else { return nil }
        guard ActivityAuthorizationInfo().areActivitiesEnabled else {
            return "Live Activity가 꺼져 있습니다. 설정 앱에서 AYR의 Live Activity를 허용해주세요."
        }
        let now = Date()
        let calendar = spendingCalendar()
        let midnight = calendar.date(byAdding: .day, value: 1, to: calendar.startOfDay(for: now))!
        let state = SpendingActivityAttributes.ContentState(day: ledger.current.day, total: ledger.current.total, budget: ledger.settings.dailyBudget)
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
                return "지출은 저장했지만 Live Activity를 시작하지 못했습니다. 앱을 열고 다시 시도해주세요."
            }
        }
        return nil
    }
}
