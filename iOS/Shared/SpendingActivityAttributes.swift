import ActivityKit

struct SpendingActivityAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        let day: String
        let total: Int
        let budget: Int
    }
}
