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
                    Section("합계로 남은 지출") {
                        LabeledContent("이전 합계", value: money(ledger.current.carriedTotal))
                        Text("날짜나 시간대가 바뀌기 전에 합계로 남긴 기록이에요. 이 금액은 바꿀 수 없고, 아래 지출만 하나씩 지울 수 있어요.")
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
                    Text("자동으로 더해졌든 직접 적었든, 위 목록의 지출은 지울 수 있어요. 합계로 남은 기록은 바꿀 수 없어요. 금액만 보관하며 지난 날짜의 지출은 수정할 수 없어요.")
                    Text("직접 적거나 지운 결제도 문자가 다시 오면 한 번 더 더해져요. 겹친 지출은 이 목록에서 지워주세요.")
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
            Text("오늘 쓴 돈과 이번 달 합계에서 빠져요. 같은 결제 문자가 다시 오면 다시 더해질 수 있어요.")
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
                Text("1~\(money(maximumMoney)) 사이의 숫자로 적어주세요.")
                    .font(.footnote).foregroundStyle(.secondary)
            }
            Section {
                Text("결제 문자가 오기 전에 직접 적으면 두 번 더해질 수 있어요. 겹친 지출은 오늘 지출 목록에서 지워주세요.")
                    .font(.footnote).foregroundStyle(.secondary)
            }
            if let today = model.ledger?.current.day, today != expectedDay {
                Section("날짜가 바뀌었어요") {
                    Text("적어둔 금액은 그대로예요. 오늘 쓴 돈에 더하려면 날짜를 다시 확인해주세요.")
                    Button("오늘 날짜로 바꾸기") {
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
