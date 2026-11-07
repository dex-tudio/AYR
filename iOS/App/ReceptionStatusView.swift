import SwiftUI
import AYRCore

struct ReceptionStatusView: View {
    let ledger: SpendingLedger

    var body: some View {
        if let attempt = ledger.lastAttempt {
            VStack(alignment: .leading, spacing: 6) {
                Text("마지막 문자 도착: \(attempt.date.formatted(date: .abbreviated, time: .shortened))")
                    .font(.footnote).foregroundStyle(.secondary)
                Label(attempt.status.message, systemImage: successful(attempt.status) ? "checkmark.circle" : "exclamationmark.circle")
            }
        } else if let reception = ledger.lastReception {
            Text("마지막 연결: \(reception.formatted(date: .abbreviated, time: .shortened)) · 다음 문자부터 처리 결과도 함께 보여드려요.")
                .font(.footnote).foregroundStyle(.secondary)
        } else {
            Label("아직 도착한 결제 문자가 없어요", systemImage: "clock")
                .foregroundStyle(.secondary)
        }
    }

    private func successful(_ status: ReceptionStatus) -> Bool { status == .success || status == .test }
}
