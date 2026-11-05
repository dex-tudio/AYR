import Foundation
import AYRCore

enum CheckError: Error { case failed(String), simulated }

func check(_ condition: @autoclosure () throws -> Bool, _ name: String) throws {
    guard try condition() else { throw CheckError.failed(name) }
}

let approval = "[Web발신]\nKB국민체크(1234)\n가*명님\n11/04 10:00\n100원\n가짜상점 사용"

if CommandLine.arguments.count == 4, CommandLine.arguments[1] == "worker" {
    do {
        let store = SpendingStore(directory: URL(fileURLWithPath: CommandLine.arguments[2]))
        for _ in 0..<Int(CommandLine.arguments[3])! {
            try store.modify { _ = try $0.receive(approval) }
        }
    } catch { exit(1) }
    exit(0)
}

let directory = FileManager.default.temporaryDirectory.appendingPathComponent("ayr-store-check-" + UUID().uuidString)
let store = SpendingStore(directory: directory)
let file = directory.appendingPathComponent("ledger.json")
var passed = 0

func run(_ name: String, _ body: () throws -> Void) throws {
    try body()
    passed += 1
    print("PASS " + name)
}

do {
    defer { try? FileManager.default.removeItem(at: directory) }
    try run("new store and onboarding round trip") {
        try check(try !store.read().onboardingCompleted, "new store")
        try store.modify { $0.completeOnboarding() }
        try check(try store.read().onboardingCompleted, "onboarding saved")
    }
    try run("payment persists without source text") {
        try store.modify { _ = try $0.receive(approval) }
        try check(try store.read().current.total == 100, "payment saved")
        let json = try String(contentsOf: file, encoding: .utf8)
        try check(!json.contains("가짜상점") && !json.contains("KB국민체크") && !json.contains("가*명"), "no source text")
    }
    try run("failed transaction leaves bytes untouched") {
        let before = try Data(contentsOf: file)
        do {
            try store.modify {
                _ = try $0.receive(approval)
                throw CheckError.simulated
            }
            throw CheckError.failed("expected transaction failure")
        } catch CheckError.simulated { }
        try check(try Data(contentsOf: file) == before, "rollback")
    }
    try run("test reception does not add spending") {
        try store.modify { _ = try $0.receive(PaymentSource.kbCheckSMS.testMessage) }
        let ledger = try store.read()
        try check(ledger.lastReception != nil && ledger.current.total == 100, "test reception")
    }
    try run("concurrent processes preserve every payment") {
        var workers: [Process] = []
        for _ in 0..<4 {
            let worker = Process()
            worker.executableURL = URL(fileURLWithPath: CommandLine.arguments[0])
            worker.arguments = ["worker", directory.path, "20"]
            try worker.run()
            workers.append(worker)
        }
        for worker in workers {
            worker.waitUntilExit()
            try check(worker.terminationStatus == 0, "worker exit")
        }
        try check(try store.read().current.total == 8_100, "concurrent total")
    }
    let validData = try Data(contentsOf: file)
    try run("corrupt data is preserved on reads and writes") {
        let broken = Data("invalid saved data".utf8)
        try broken.write(to: file)
        do {
            _ = try store.read()
            throw CheckError.failed("expected read error")
        } catch SpendingStoreError.unreadable { }
        do {
            try store.modify { $0.completeOnboarding() }
            throw CheckError.failed("expected write blocked")
        } catch SpendingStoreError.unreadable { }
        try check(try Data(contentsOf: file) == broken, "corrupt data retained")
        try validData.write(to: file)
    }
    try run("unknown storage version cannot be overwritten") {
        var object = try JSONSerialization.jsonObject(with: validData) as! [String: Any]
        object["version"] = 99
        let unsupported = try JSONSerialization.data(withJSONObject: object)
        try unsupported.write(to: file)
        do {
            try store.modify { _ = try $0.receive(approval) }
            throw CheckError.failed("expected version error")
        } catch SpendingStoreError.unsupportedVersion { }
        try check(try Data(contentsOf: file) == unsupported, "version data retained")
    }
    try run("storage failure is reported") {
        let blocked = directory.appendingPathComponent("not-a-directory")
        try Data().write(to: blocked)
        do {
            _ = try SpendingStore(directory: blocked).read()
            throw CheckError.failed("expected storage failure")
        } catch SpendingStoreError.unavailable { }
    }
    try run("read persists rollover and retention") {
        let historyDirectory = directory.appendingPathComponent("history")
        let historyStore = SpendingStore(directory: historyDirectory)
        let start = Calendar.current.startOfDay(for: Date())
        let yesterday = Calendar.current.date(byAdding: .day, value: -1, to: start)!
        try historyStore.modify(now: yesterday) {
            $0.completeOnboarding(now: yesterday)
            _ = try $0.receive(approval, now: yesterday)
        }
        _ = try historyStore.read(now: start)
        let historyFile = historyDirectory.appendingPathComponent("ledger.json")
        let object = try JSONSerialization.jsonObject(with: Data(contentsOf: historyFile)) as! [String: Any]
        let ledger = object["ledger"] as! [String: Any]
        let current = ledger["current"] as! [String: Any]
        try check(current["day"] as? String == dayKey(for: start), "day persisted")
        try check((current["approvals"] as? [Int])?.isEmpty == true, "old approvals discarded")
        let future = Calendar.current.date(byAdding: .month, value: 13, to: start)!
        _ = try historyStore.read(now: future)
        let prunedObject = try JSONSerialization.jsonObject(with: Data(contentsOf: historyFile)) as! [String: Any]
        let prunedLedger = prunedObject["ledger"] as! [String: Any]
        let prunedRecords = prunedLedger["records"] as! [String: Any]
        try check(prunedRecords[dayKey(for: yesterday)] == nil, "retention persisted")
    }
    try run("write failure is reported") {
        let failedDirectory = directory.appendingPathComponent("write-failure")
        let failedStore = SpendingStore(directory: failedDirectory)
        do {
            try failedStore.modify { ledger in
                ledger.completeOnboarding()
                try FileManager.default.createDirectory(at: failedDirectory.appendingPathComponent("ledger.json"), withIntermediateDirectories: false)
            }
            throw CheckError.failed("expected write failure")
        } catch SpendingStoreError.unwritable { }
    }
    try run("manual add and automatic or manual removal persist") {
        let editable = SpendingStore(directory: directory.appendingPathComponent("editable"))
        let initial = try editable.modify {
            $0.completeOnboarding()
            _ = try $0.receive(approval)
        }
        let reception = try editable.read().lastReception
        let added = try editable.modify { try $0.addSpending(250, expectedDay: initial.current.day) }
        try check(added.current.total == 350 && added.lastReception == reception, "manual addition")
        let removedAuto = try editable.modify { try $0.removeSpending(at: 0, expected: added.current) }
        try check(removedAuto.current.approvals == [250], "automatic entry removed")
        try check(try editable.read().summary(for: Date()).total == 250, "month total updated")
        try editable.modify { try $0.removeSpending(at: 0, expected: removedAuto.current) }
        let empty = try editable.read()
        try check(empty.current.total == 0 && empty.summary(for: Date()).total == 0, "last entry removed")
    }
    try run("new receipt invalidates removal snapshot without losing payment") {
        let editable = SpendingStore(directory: directory.appendingPathComponent("stale-removal"))
        let before = try editable.modify {
            $0.completeOnboarding()
            try $0.addSpending(100, expectedDay: $0.current.day)
        }
        try editable.modify { _ = try $0.receive(approval) }
        let editableFile = directory.appendingPathComponent("stale-removal/ledger.json")
        let bytes = try Data(contentsOf: editableFile)
        do {
            try editable.modify { try $0.removeSpending(at: 0, expected: before.current) }
            throw CheckError.failed("expected stale snapshot error")
        } catch LedgerError.spendingChanged { }
        try check(try Data(contentsOf: editableFile) == bytes, "stale removal leaves file intact")
        let fresh = try editable.read()
        try editable.modify { try $0.removeSpending(at: 1, expected: fresh.current) }
        try editable.modify { _ = try $0.receive(approval) }
        try check(try editable.read().current.approvals == [100, 100], "repeated receipt is independently counted")
    }
    try run("midnight rejects old manual form and removal confirmation") {
        let editable = SpendingStore(directory: directory.appendingPathComponent("midnight-edit"))
        let today = spendingCalendar().startOfDay(for: Date())
        let yesterday = spendingCalendar().date(byAdding: .day, value: -1, to: today)!
        let before = try editable.modify(now: yesterday) {
            $0.completeOnboarding(now: yesterday)
            try $0.addSpending(100, expectedDay: $0.current.day, now: yesterday)
        }
        do {
            try editable.modify(now: today) { try $0.addSpending(200, expectedDay: before.current.day, now: today) }
            throw CheckError.failed("expected old form error")
        } catch LedgerError.dayChanged { }
        do {
            try editable.modify(now: today) { try $0.removeSpending(at: 0, expected: before.current, now: today) }
            throw CheckError.failed("expected old confirmation error")
        } catch LedgerError.dayChanged { }
        let latest = try editable.read(now: today)
        try check(latest.current.total == 0 && latest.records[before.current.day]?.total == 100, "yesterday preserved")
        try editable.modify(now: today) { try $0.addSpending(200, expectedDay: latest.current.day, now: today) }
        try check(try editable.read(now: today).current.total == 200, "retained amount retried with confirmed current day")
    }

    try run("archived total remains protected after storage round trip") {
        let protectedStore = SpendingStore(directory: directory.appendingPathComponent("protected"))
        let today = spendingCalendar().startOfDay(for: Date())
        let tomorrow = spendingCalendar().date(byAdding: .day, value: 1, to: today)!
        try protectedStore.modify(now: today) {
            $0.completeOnboarding(now: today)
            try $0.addSpending(250, expectedDay: $0.current.day, now: today)
        }
        _ = try protectedStore.read(now: tomorrow)
        let restored = try protectedStore.read(now: today)
        try check(restored.current.carriedTotal == 250 && restored.current.approvals.isEmpty, "old total not exposed as a deletable row")
        let appended = try protectedStore.modify(now: today) {
            try $0.addSpending(100, expectedDay: $0.current.day, now: today)
        }
        try protectedStore.modify(now: today) { try $0.removeSpending(at: 0, expected: appended.current, now: today) }
        let remaining = try protectedStore.read(now: today)
        try check(remaining.current.total == 250 && remaining.current.approvals.isEmpty, "only new spending removed")
    }
    print("Storage checks: \(passed) passed")
} catch {
    print("FAIL \(error)")
    exit(1)
}
