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
        case .unavailable: "기기 저장 공간에 접근하지 못했습니다. 기기를 한 번 잠금 해제한 뒤 다시 시도해주세요."
        case .unreadable: "저장된 기록이 손상되었습니다. 원본은 보존했습니다. 원본을 따로 보관하고 새로 시작할 수 있습니다."
        case .unwritable: "기록을 저장하지 못했습니다. 입력은 반영되지 않았습니다. 다시 시도해주세요."
        case .unsupportedVersion: "이 기록은 다른 버전에서 저장되었습니다. 앱을 업데이트해주세요."
        case .resetNotNeeded: "기록이 정상으로 확인되어 초기화하지 않았습니다. 다시 읽어주세요."
        case .backupFailed: "손상된 원본을 따로 보관하지 못해 초기화하지 않았습니다. 기존 파일은 유지했습니다."
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
