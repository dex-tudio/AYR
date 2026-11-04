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
        object["version"] = 2
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
    print("Storage checks: \(passed) passed")
} catch {
    print("FAIL \(error)")
    exit(1)
}
