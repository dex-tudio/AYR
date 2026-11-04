import Foundation
import AYRCore
#if canImport(Darwin)
import Darwin
#else
import Glibc
#endif

enum SpendingStoreError: LocalizedError {
    case unavailable, unreadable, unwritable, unsupportedVersion

    var errorDescription: String? {
        switch self {
        case .unavailable: "기기 저장 공간에 접근하지 못했습니다. 기기를 한 번 잠금 해제한 뒤 다시 시도해주세요."
        case .unreadable: "저장된 기록을 읽지 못했습니다. 기존 기록은 유지했습니다. 다시 시도해주세요."
        case .unwritable: "기록을 저장하지 못했습니다. 입력은 반영되지 않았습니다. 다시 시도해주세요."
        case .unsupportedVersion: "이 기록은 다른 버전에서 저장되었습니다. 앱을 업데이트해주세요."
        }
    }
}

struct SpendingStore {
    static let appGroup = "group.dev.ayr.shared"
    private let directory: URL

    init() throws {
        #if os(iOS)
        guard let url = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: Self.appGroup) else {
            throw SpendingStoreError.unavailable
        }
        directory = url.appendingPathComponent("Spending", isDirectory: true)
        #else
        throw SpendingStoreError.unavailable
        #endif
    }

    init(directory: URL) { self.directory = directory }

    func read(now: Date = Date()) throws -> SpendingLedger {
        try modify(now: now) { _ in }
    }

    @discardableResult
    func modify(now: Date = Date(), _ change: (inout SpendingLedger) throws -> Void) throws -> SpendingLedger {
        try locked {
            var ledger = try load(now: now)
            let previous = ledger
            ledger.refresh(now: now)
            try change(&ledger)
            if ledger == previous && FileManager.default.fileExists(atPath: recordURL.path) { return ledger }
            try save(ledger)
            return ledger
        }
    }

    private var recordURL: URL { directory.appendingPathComponent("ledger.json") }

    private func save(_ ledger: SpendingLedger) throws {
        do {
            let encoder = JSONEncoder()
            encoder.dateEncodingStrategy = .iso8601
            let data = try encoder.encode(SavedLedger(version: 1, ledger: ledger))
            #if os(iOS)
            try data.write(to: recordURL, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
            #else
            try data.write(to: recordURL, options: .atomic)
            #endif
        } catch { throw SpendingStoreError.unwritable }
    }

    private func load(now: Date) throws -> SpendingLedger {
        guard FileManager.default.fileExists(atPath: recordURL.path) else { return SpendingLedger(now: now) }
        do {
            let decoder = JSONDecoder()
            decoder.dateDecodingStrategy = .iso8601
            let saved = try decoder.decode(SavedLedger.self, from: Data(contentsOf: recordURL))
            guard saved.version == 1 else { throw SpendingStoreError.unsupportedVersion }
            return saved.ledger
        } catch let error as SpendingStoreError { throw error }
        catch { throw SpendingStoreError.unreadable }
    }

    private func locked<T>(_ work: () throws -> T) throws -> T {
        do {
            try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
            #if os(iOS)
            try FileManager.default.setAttributes([.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication], ofItemAtPath: directory.path)
            var url = directory
            var values = URLResourceValues()
            values.isExcludedFromBackup = true
            try url.setResourceValues(values)
            #endif
        } catch { throw SpendingStoreError.unavailable }
        let fd = open(directory.appendingPathComponent("ledger.lock").path, O_CREAT | O_RDWR, S_IRUSR | S_IWUSR)
        guard fd >= 0 else { throw SpendingStoreError.unavailable }
        defer { close(fd) }
        // 앱·단축어가 동시에 받아도 최신 파일을 읽고 한 건씩 원자적으로 반영한다.
        guard flock(fd, LOCK_EX) == 0 else { throw SpendingStoreError.unavailable }
        defer { _ = flock(fd, LOCK_UN) }
        return try work()
    }

    private struct SavedLedger: Codable {
        let version: Int
        let ledger: SpendingLedger
    }
}
