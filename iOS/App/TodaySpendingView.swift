import SwiftUI
import AYRCore

struct TodaySpendingView: View {
    @EnvironmentObject private var model: AppModel
    @State private var addition: Addition?
    @State private var pendingRemoval: PendingRemoval?

    var body: some View {
        List {
            if let ledger = model.ledger {
                Section {
                    LabeledContent("오늘 합계", value: money(ledger.current.total))
                    Text(phrase(total: ledger.current.total, budget: ledger.currentBudget))
                        .font(.title2.bold())
                        .foregroundStyle(spendingColor(total: ledger.current.total, budget: ledger.currentBudget))
                }
                if ledger.current.carriedTotal > 0 {
                    Section("이미 보관된 지출") {
                        LabeledContent("이전 합계", value: money(ledger.current.carriedTotal))
                        Text("날짜·시간대가 바뀌기 전에 합계로 보관한 기록입니다. 이 금액은 보호하며, 아래 새 지출만 개별 삭제할 수 있습니다.")
                            .font(.footnote).foregroundStyle(.secondary)
                    }
                }
                Section("새로 기록된 지출 \(ledger.current.approvals.count)건") {
                    if ledger.current.approvals.isEmpty {
                        Text("새로 기록된 지출이 없어요.").foregroundStyle(.secondary)
                    }
                    ForEach(Array(ledger.current.approvals.enumerated()), id: \.offset) { index, amount in
                        HStack {
                            Text("지출 \(index + 1)").foregroundStyle(.secondary)
                            Spacer()
                            Text(money(amount)).monospacedDigit()
                            Button(role: .destructive) {
                                pendingRemoval = PendingRemoval(spending: ledger.current, index: index)
                            } label: {
                                Image(systemName: "trash").frame(minWidth: 44, minHeight: 44)
                            }
                            .buttonStyle(.borderless)
                            .accessibilityLabel("\(index + 1)번째 지출 \(money(amount)) 삭제")
                        }
                    }
                }
                Section {
                    Text("새로 자동 수집·수동 추가한 지출은 모두 삭제할 수 있습니다. 이미 합계로 보관된 기록은 보호합니다. 금액만 보관하며 과거 날짜를 골라 수정할 수는 없습니다.")
                    Text("수동으로 적은 결제나 삭제한 결제 문자가 다시 들어오면 별도로 합산됩니다. 중복은 이 목록에서 삭제해주세요.")
                        .font(.footnote).foregroundStyle(.secondary)
                }
            }
            if let error = model.error {
                Section("반영하지 못했어요") { Text(error).foregroundStyle(.red) }
            }
        }
        .ayrScreen()
        .navigationTitle("오늘 지출")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button {
                    guard let day = model.ledger?.current.day else { return }
                    addition = Addition(day: day)
                } label: { Label("추가", systemImage: "plus") }
            }
        }
        .onAppear { model.reload() }
        .sheet(item: $addition) { request in
            NavigationStack { AddSpendingView(day: request.day) }
        }
        .confirmationDialog("이 지출을 삭제할까요?", isPresented: Binding(
            get: { pendingRemoval != nil },
            set: { if !$0 { pendingRemoval = nil } }
        ), titleVisibility: .visible, presenting: pendingRemoval) { removal in
            Button("\(money(removal.amount)) 삭제", role: .destructive) {
                if model.removeSpending(at: removal.index, expected: removal.spending) {
                    Task { await model.refreshActivity() }
                }
                pendingRemoval = nil
            }
            Button("취소", role: .cancel) { pendingRemoval = nil }
        } message: { _ in
            Text("오늘 합계와 월별 기록에 반영됩니다. 같은 결제 문자가 다시 들어오면 다시 합산될 수 있습니다.")
        }
    }

    private struct PendingRemoval {
        let spending: DailySpending
        let index: Int
        var amount: Int { spending.approvals[index] }
    }

    private struct Addition: Identifiable {
        let day: String
        var id: String { day }
    }
}

private struct AddSpendingView: View {
    @State private var expectedDay: String
    @EnvironmentObject private var model: AppModel
    @Environment(\.dismiss) private var dismiss
    @State private var text = ""
    @State private var saving = false

    init(day: String) { _expectedDay = State(initialValue: day) }

    var body: some View {
        Form {
            Section("오늘 지출 금액") {
                MoneyField(title: "금액(원)", text: $text)
                Text("1~\(money(maximumMoney)) 범위의 숫자로 입력해주세요.")
                    .font(.footnote).foregroundStyle(.secondary)
            }
            Section {
                Text("자동으로 수집될 결제를 미리 입력하면 중복 합산될 수 있습니다. 입력 후에는 오늘 지출 목록에서 삭제할 수 있습니다.")
                    .font(.footnote).foregroundStyle(.secondary)
            }
            if let today = model.ledger?.current.day, today != expectedDay {
                Section("날짜가 바뀌었어요") {
                    Text("입력한 금액은 유지했습니다. 오늘 지출로 추가하려면 날짜를 다시 확인해주세요.")
                    Button("오늘 날짜로 다시 입력") {
                        model.reload()
                        if let day = model.ledger?.current.day { expectedDay = day }
                    }
                }
            }
            if let error = model.error {
                Section("저장하지 못했어요") { Text(error).foregroundStyle(.red) }
            }
        }
        .ayrScreen()
        .navigationTitle("지출 추가")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) { Button("취소") { dismiss() } }
            ToolbarItem(placement: .confirmationAction) {
                Button("추가") {
                    guard !saving, let amount = positiveMoney(text) else { return }
                    saving = true
                    if model.addSpending(amount, expectedDay: expectedDay) {
                        dismiss()
                        Task { await model.refreshActivity() }
                    } else { saving = false }
                }
                .disabled(saving || positiveMoney(text) == nil || model.ledger?.current.day != expectedDay)
            }
        }
    }
}
