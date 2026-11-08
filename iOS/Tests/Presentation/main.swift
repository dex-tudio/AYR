import AYRCore

precondition(money(0) == "0원")
precondition(money(1_234_567) == "1,234,567원")
print("PASS shared won formatting")

precondition(positiveMoney("1") == 1)
precondition(positiveMoney(String(maximumMoney)) == maximumMoney)
print("PASS positive money bounds")

for text in ["", "0", "-1", "+1", " 1", "1 ", "1,000", "1.5", "１２３", "١٢٣", String(maximumMoney + 1), String(Int.max) + "0"] {
    precondition(positiveMoney(text) == nil)
}
print("PASS invalid money input rejected")
let noSources = AppSettings(identity: .student)!
precondition(noSources.smsAutomationSources.isEmpty)
print("PASS no automation guide for empty selection")

let unsupported = AppSettings(identity: .student, sources: [.tossNotification])!
precondition(unsupported.smsAutomationSources.isEmpty)
print("PASS unsupported sources excluded from SMS guides")

let selected = AppSettings(identity: .student, sources: [.kbCheckSMS, .tossNotification])!
precondition(selected.smsAutomationSources == [.kbCheckSMS])
print("PASS only selected supported SMS sources shown")

for source in selected.smsAutomationSources {
    precondition(source.testMessage.contains(source.filterKeyword!))
    precondition(selected.parse(source.testMessage) == .test)
    var day = DailySpending(day: "2026-11-08")
    precondition(!day.apply(selected.parse(source.testMessage)!))
    precondition(day.total == 0)
}
print("PASS guide test messages match filter without counting spending")
print("Presentation checks: 7 passed")
