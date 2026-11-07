import SwiftUI
import AYRCore

struct IdentityBudgetFields: View {
    @Binding var identity: Identity
    @Binding var budget: String

    var body: some View {
        Picker("신분", selection: $identity) {
            ForEach(Identity.allCases, id: \.self) { Text($0.title).tag($0) }
        }
        .onChange(of: identity) { _, value in budget = String(value.defaultBudget) }
        MoneyField(title: "하루 기준 금액(원)", text: $budget)
        Text("신분을 바꾸면 하루 기준도 추천 금액으로 바뀌어요. 원하는 금액으로 다시 정할 수 있어요.")
            .font(.footnote).foregroundStyle(.secondary)
    }
}

struct MoneyField: View {
    let title: String
    @Binding var text: String

    var body: some View {
        TextField(title, text: $text)
            .keyboardType(.numberPad)
            .accessibilityLabel(title)
    }
}

struct SourcePicker: View {
    @Binding var sources: Set<PaymentSource>

    var body: some View {
        ForEach(PaymentSource.allCases, id: \.self) { source in
            if source.isSupported {
                Toggle(source.title, isOn: Binding(
                    get: { sources.contains(source) },
                    set: { if $0 { sources.insert(source) } else { sources.remove(source) } }
                ))
            } else {
                LabeledContent(source.title, value: "준비 중")
                    .foregroundStyle(.secondary)
            }
        }
    }
}
