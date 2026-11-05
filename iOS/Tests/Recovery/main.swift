import Foundation
import AYRCore
import Glibc

enum RecoveryCheckError: Error { case failed(String) }

func check(_ condition: @autoclosure () throws -> Bool, _ name: String) throws {
    guard try condition() else { throw RecoveryCheckError.failed(name) }
}

func expect(_ expected: SpendingStoreError, _ work: () throws -> Void) throws {
    do {
        try work()
        throw RecoveryCheckError.failed("expected \(expected)")
    } catch let error as SpendingStoreError {
        try check(error == expected, "expected \(expected), received \(error)")
    }
}

if CommandLine.arguments.count == 4, CommandLine.arguments[1] == "worker" {
    guard setgid(65534) == 0, setuid(65534) == 0 else { exit(2) }
    let store = SpendingStore(directory: URL(fileURLWithPath: CommandLine.arguments[2]))
    do {
        switch CommandLine.arguments[3] {
        case "unavailable":
            try expect(.unavailable) { _ = try store.read() }
            try expect(.unavailable) { _ = try store.resetPreservingOriginal() }
        case "backupFailed":
            try expect(.backupFailed) { _ = try store.resetPreservingOriginal() }
        case "unwritable":
            try expect(.unwritable) { _ = try store.resetPreservingOriginal() }
        default: exit(3)
        }
        exit(0)
    } catch {
        print("FAIL isolated recovery worker: \(error)")
        exit(1)
    }
}

let files = FileManager.default
let directory = files.temporaryDirectory.appendingPathComponent("ayr-recovery-check-" + UUID().uuidString)
let damaged = Data("damaged synthetic ledger".utf8)
var passed = 0

func run(_ name: String, _ work: () throws -> Void) throws {
    try work()
    passed += 1
    print("PASS " + name)
}

func folder(_ name: String) throws -> URL {
    let url = directory.appendingPathComponent(name, isDirectory: true)
    try files.createDirectory(at: url, withIntermediateDirectories: true)
    return url
}

func recoveryFiles(in url: URL) throws -> [URL] {
    try files.contentsOfDirectory(at: url, includingPropertiesForKeys: nil)
        .filter { $0.lastPathComponent.hasPrefix("recovery-") && $0.pathExtension == "json" }
}

func object(at url: URL) throws -> [String: Any] {
    try JSONSerialization.jsonObject(with: Data(contentsOf: url)) as! [String: Any]
}

func deniedWorker(_ operation: String, mode: Int, fileMode: Int = 0o444) throws -> URL {
    let url = try folder(operation)
    try damaged.write(to: url.appendingPathComponent("ledger.json"))
    try Data().write(to: url.appendingPathComponent("ledger.lock"))
    try files.setAttributes([.posixPermissions: fileMode], ofItemAtPath: url.appendingPathComponent("ledger.json").path)
    try files.setAttributes([.posixPermissions: 0o666], ofItemAtPath: url.appendingPathComponent("ledger.lock").path)
    try files.setAttributes([.posixPermissions: mode], ofItemAtPath: url.path)
    let process = Process()
    process.executableURL = URL(fileURLWithPath: CommandLine.arguments[0])
    process.arguments = ["worker", url.path, operation]
    try process.run()
    process.waitUntilExit()
    try check(process.terminationStatus == 0, "isolated \(operation) worker exit")
    try check(try Data(contentsOf: url.appendingPathComponent("ledger.json")) == damaged, "original survives \(operation)")
    return url
}

do {
    // 실제 권한 실패는 Docker의 root 부모와 권한을 낮춘 자식으로 검증한다.
    try check(geteuid() == 0, "run recovery checks in the default Linux Docker container")
    try files.createDirectory(at: directory, withIntermediateDirectories: true)
    try files.setAttributes([.posixPermissions: 0o755], ofItemAtPath: directory.path)
    defer { try? files.removeItem(at: directory) }

    try run("only corrupt data offers reset") {
        try check(SpendingStoreError.unreadable.canReset, "corruption eligible")
        for error in [SpendingStoreError.unavailable, .unwritable, .unsupportedVersion, .resetNotNeeded, .backupFailed] {
            try check(!error.canReset, "other errors ineligible")
        }
    }
    try run("missing record cannot be reset") {
        let url = try folder("missing")
        try expect(.resetNotNeeded) { _ = try SpendingStore(directory: url).resetPreservingOriginal() }
        try check(!files.fileExists(atPath: url.appendingPathComponent("ledger.json").path), "missing record stays missing")
        try check(try recoveryFiles(in: url).isEmpty, "no unnecessary backup")
    }
    try run("healthy record is retained without a backup") {
        let url = try folder("healthy")
        let store = SpendingStore(directory: url)
        try store.modify { $0.completeOnboarding() }
        let record = url.appendingPathComponent("ledger.json")
        let original = try Data(contentsOf: record)
        try expect(.resetNotNeeded) { _ = try store.resetPreservingOriginal() }
        try check(try Data(contentsOf: record) == original, "healthy bytes retained")
        try check(try recoveryFiles(in: url).isEmpty, "healthy record not backed up")
    }
    try run("corrupt original is preserved before a fresh ledger starts") {
        let url = try folder("corrupt")
        let record = url.appendingPathComponent("ledger.json")
        try damaged.write(to: record)
        let store = SpendingStore(directory: url)
        try expect(.unreadable) { _ = try store.read() }
        let fresh = try store.resetPreservingOriginal()
        try check(!fresh.onboardingCompleted && fresh.firstDay == nil && fresh.current.total == 0 && fresh.records.isEmpty, "fresh ledger")
        try check(fresh.lastReception == nil, "reception reset")
        let backups = try recoveryFiles(in: url)
        try check(backups.count == 1, "one recovery file")
        try check(try Data(contentsOf: backups[0]) == damaged, "exact original bytes retained")
        try check(try object(at: record)["version"] as? Int == 2, "fresh version two")
        try check(try store.read() == fresh, "fresh ledger saved")
        try expect(.resetNotNeeded) { _ = try store.resetPreservingOriginal() }
        try check(try recoveryFiles(in: url).count == 1, "repeat reset refused")
    }
    try run("invalid ledger content is recoverable") {
        let url = try folder("invalid-content")
        let record = url.appendingPathComponent("ledger.json")
        let original = Data("{\"version\":1,\"ledger\":{}}".utf8)
        try original.write(to: record)
        _ = try SpendingStore(directory: url).resetPreservingOriginal()
        let backups = try recoveryFiles(in: url)
        try check(backups.count == 1 && Data(contentsOf: backups[0]) == original, "invalid content preserved")
    }
    try run("separate resets never overwrite earlier recovery copies") {
        let url = try folder("repeated-damage")
        let record = url.appendingPathComponent("ledger.json")
        let store = SpendingStore(directory: url)
        let laterDamage = Data("different synthetic damaged ledger".utf8)
        try damaged.write(to: record)
        _ = try store.resetPreservingOriginal()
        try laterDamage.write(to: record)
        _ = try store.resetPreservingOriginal()
        let backups = try recoveryFiles(in: url)
        try check(backups.count == 2, "unique recovery files")
        let copies = try Set(backups.map { try Data(contentsOf: $0) })
        try check(copies == Set([damaged, laterDamage]), "both originals retained")
    }
    try run("legacy version one reads and next changed save writes version two") {
        let url = try folder("legacy")
        let store = SpendingStore(directory: url)
        _ = try store.read()
        let record = url.appendingPathComponent("ledger.json")
        var saved = try object(at: record)
        saved["version"] = 1
        try JSONSerialization.data(withJSONObject: saved).write(to: record)
        try check(try !store.read().onboardingCompleted, "legacy version accepted")
        try store.modify { $0.completeOnboarding() }
        try check(try object(at: record)["version"] as? Int == 2, "changed ledger saved as two")
    }
    try run("unknown version is refused before incompatible content decoding") {
        let url = try folder("future")
        let record = url.appendingPathComponent("ledger.json")
        let original = Data("{\"version\":99,\"ledger\":\"future incompatible content\"}".utf8)
        try original.write(to: record)
        let store = SpendingStore(directory: url)
        try expect(.unsupportedVersion) { _ = try store.read() }
        try expect(.unsupportedVersion) { _ = try store.resetPreservingOriginal() }
        try check(try Data(contentsOf: record) == original, "future version unchanged")
        try check(try recoveryFiles(in: url).isEmpty, "future version not backed up or reset")
    }
    try run("confirmation rechecks a file that has already recovered") {
        let url = try folder("recovered")
        let store = SpendingStore(directory: url)
        let record = url.appendingPathComponent("ledger.json")
        _ = try store.read()
        let healthy = try Data(contentsOf: record)
        try damaged.write(to: record)
        try expect(.unreadable) { _ = try store.read() }
        try healthy.write(to: record)
        try expect(.resetNotNeeded) { _ = try store.resetPreservingOriginal() }
        try check(try Data(contentsOf: record) == healthy, "recovered record retained")
        try check(try recoveryFiles(in: url).isEmpty, "no stale reset backup")
    }
    try run("permission failure never becomes recoverable corruption") {
        let url = try deniedWorker("unavailable", mode: 0o755, fileMode: 0)
        try check(try recoveryFiles(in: url).isEmpty, "read denial creates no recovery file")
    }
    try run("backup failure leaves original untouched") {
        let url = try deniedWorker("backupFailed", mode: 0o755)
        try check(try recoveryFiles(in: url).isEmpty, "failed backup creates no recovery file")
    }
    try run("failed replacement retains both original and successful backup") {
        let url = try deniedWorker("unwritable", mode: 0o1777)
        let backups = try recoveryFiles(in: url)
        try check(backups.count == 1, "backup succeeded before replacement denied")
        try check(try Data(contentsOf: backups[0]) == damaged, "backup bytes retained")
    }
    print("Recovery checks: \(passed) passed")
} catch {
    print("FAIL \(error)")
    exit(1)
}
