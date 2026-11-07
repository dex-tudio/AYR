import Foundation

public enum ReceptionStatus: String, Codable, Equatable, Sendable {
    case success, test, ignored, overflow, notConfigured

    public var message: String {
        switch self {
        case .success: "오늘 쓴 돈에 더했어요"
        case .test: "확인용 문자가 도착했어요. 지출에는 더하지 않았어요."
        case .ignored: "지원하는 결제 문자가 아니어서 지출에 더하지 않았어요."
        case .overflow: "기록할 수 있는 최대 금액을 넘어 지출에 더하지 못했어요."
        case .notConfigured: "앱에서 시작하기를 먼저 마쳐주세요."
        }
    }
}

public struct ReceptionAttempt: Codable, Equatable, Sendable {
    public let date: Date
    public let status: ReceptionStatus

    public init(date: Date, status: ReceptionStatus) {
        self.date = date
        self.status = status
    }
}
