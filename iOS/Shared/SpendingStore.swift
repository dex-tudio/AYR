import Foundation
import AYRCore
#if canImport(Darwin)
import Darwin
#else
import Glibc
#endif

enum SpendingStoreError: LocalizedError, Equatable {
    case unavailable, unreadable, unwritable, unsupportedVersion, resetNotNeeded, backupFailed

    var canReset: Bool {
        if case .unreadable = self { return true }
        return false
    }

    var errorDescription: String? {
        switch self {
        case .unavailable: "기기 안의 기록에 접근하지 못했어요. 잠금을 한 번 해제한 뒤 다시 시도해주세요."
        case .unreadable: "저장된 기록이 손상됐어요. 원본은 그대로 두었어요. 원본을 따로 보관하고 새로 시작할 수 있어요."
        case .unwritable: "기록을 저장하지 못했어요. 입력한 내용은 반영되지 않았어요. 다시 시도해주세요."
        case .unsupportedVersion: "현재 앱에서 읽을 수 없는 버전의 기록이에요. 앱을 업데이트해주세요."
        case .resetNotNeeded: "기록에 문제가 없어 새로 시작하지 않았어요. 다시 불러와주세요."
        case .backupFailed: "원본을 따로 보관하지 못해 새로 시작하지 않았어요. 기존 기록은 그대로 두었어요."
        }
    }
}

struct SpendingStore {
    static let appGroup = "group.com.codemaker-kim.ayr.shared"
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

    func resetPreservingOriginal(now: Date = Date()) throws -> SpendingLedger {
        try locked {
            guard let original = try readData() else { throw SpendingStoreError.resetNotNeeded }
            do {
                _ = try decode(original)
                throw SpendingStoreError.resetNotNeeded
            } catch SpendingStoreError.unreadable {
                let recoveryURL = directory.appendingPathComponent("recovery-\(UUID().uuidString).json")
                do { try write(original, to: recoveryURL) }
                catch { throw SpendingStoreError.backupFailed }
                let ledger = SpendingLedger(now: now)
                try save(ledger)
                return ledger
            }
        }
    }

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
            let data = try encoder.encode(SavedLedger(version: 2, ledger: ledger))
            try write(data, to: recordURL)
        } catch { throw SpendingStoreError.unwritable }
    }

    private func load(now: Date) throws -> SpendingLedger {
        guard let data = try readData() else { return SpendingLedger(now: now) }
        return try decode(data)
    }

    private func readData() throws -> Data? {
        do { return try Data(contentsOf: recordURL) }
        catch let error as CocoaError where error.code == .fileReadNoSuchFile { return nil }
        catch { throw SpendingStoreError.unavailable }
    }

    private func decode(_ data: Data) throws -> SpendingLedger {
        do {
            let decoder = JSONDecoder()
            decoder.dateDecodingStrategy = .iso8601
            let header = try decoder.decode(VersionHeader.self, from: data)
            guard header.version == 1 || header.version == 2 else { throw SpendingStoreError.unsupportedVersion }
            return try decoder.decode(SavedLedger.self, from: data).ledger
        } catch let error as SpendingStoreError { throw error }
        catch { throw SpendingStoreError.unreadable }
    }

    private func write(_ data: Data, to url: URL) throws {
        #if os(iOS)
        try data.write(to: url, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
        #else
        try data.write(to: url, options: .atomic)
        #endif
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

    private struct VersionHeader: Decodable {
        let version: Int
    }
}
