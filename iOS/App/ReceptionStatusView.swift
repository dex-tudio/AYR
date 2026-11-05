import SwiftUI
import AYRCore

struct ReceptionStatusView: View {
    let ledger: SpendingLedger

    var body: some View {
        if let attempt = ledger.lastAttempt {
            VStack(alignment: .leading, spacing: 6) {
                Text("마지막 자동화 호출: \(attempt.date.formatted(date: .abbreviated, time: .shortened))")
                    .font(.footnote).foregroundStyle(.secondary)
                Label(attempt.status.message, systemImage: successful(attempt.status) ? "checkmark.circle" : "exclamationmark.circle")
            }
        } else if let reception = ledger.lastReception {
            Text("이전 수신: \(reception.formatted(date: .abbreviated, time: .shortened)) · 자세한 처리 상태는 다음 호출부터 표시합니다.")
                .font(.footnote).foregroundStyle(.secondary)
        } else {
            Label("아직 자동화 호출을 확인하지 못했어요", systemImage: "clock")
                .foregroundStyle(.secondary)
        }
    }

    private func successful(_ status: ReceptionStatus) -> Bool { status == .success || status == .test }
}
