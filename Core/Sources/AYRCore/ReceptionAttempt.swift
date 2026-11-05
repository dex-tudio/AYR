import Foundation

public enum ReceptionStatus: String, Codable, Equatable, Sendable {
    case success, test, ignored, overflow, notConfigured

    public var message: String {
        switch self {
        case .success: "결제를 반영했습니다."
        case .test: "수신 테스트 완료. 지출에는 합산하지 않았습니다."
        case .ignored: "지원되는 결제 승인 문자가 아니어서 합산하지 않았습니다."
        case .overflow: "집계할 수 있는 금액 범위를 초과해 반영하지 못했습니다."
        case .notConfigured: "앱에서 초기 설정을 먼저 완료해주세요."
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
