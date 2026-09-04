import {
	createCredentialVault,
	type CredentialVault,
	type EncryptedCredentialRecord,
	type VaultKeyStore,
	type VaultRecordStore
} from './credential-vault.ts';

const CREDENTIAL_STORAGE_KEY = 'bkalendar-next:mybk-credentials';
const DATABASE_NAME = 'bkalendar-next-private-vault';
const OBJECT_STORE_NAME = 'keys';
const ENCRYPTION_KEY_ID = 'mybk-aes-gcm';

export function createChromeCredentialVault(): CredentialVault {
	return createCredentialVault(createChromeRecordStore(), createIndexedDbKeyStore());
}

function createChromeRecordStore(): VaultRecordStore {
	return {
		async get() {
			const stored = await chrome.storage.local.get(CREDENTIAL_STORAGE_KEY);
			return stored[CREDENTIAL_STORAGE_KEY] as EncryptedCredentialRecord | undefined;
		},
		async set(record) {
			await chrome.storage.local.set({ [CREDENTIAL_STORAGE_KEY]: record });
		},
		async remove() {
			await chrome.storage.local.remove(CREDENTIAL_STORAGE_KEY);
		}
	};
}

function createIndexedDbKeyStore(): VaultKeyStore {
	return {
		async get() {
			return await transaction<CryptoKey | undefined>('readonly', (store) =>
				requestResult(store.get(ENCRYPTION_KEY_ID))
			);
		},
		async set(key) {
			await transaction('readwrite', (store) =>
				requestResult(store.put(key, ENCRYPTION_KEY_ID)).then(() => undefined)
			);
		},
		async remove() {
			await transaction('readwrite', (store) =>
				requestResult(store.delete(ENCRYPTION_KEY_ID)).then(() => undefined)
			);
		}
	};
}

async function transaction<T>(
	mode: IDBTransactionMode,
	work: (store: IDBObjectStore) => Promise<T>
): Promise<T> {
	const database = await openDatabase();
	try {
		const tx = database.transaction(OBJECT_STORE_NAME, mode);
		const result = await work(tx.objectStore(OBJECT_STORE_NAME));
		await transactionComplete(tx);
		return result;
	} finally {
		database.close();
	}
}

function openDatabase(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(DATABASE_NAME, 1);
		request.onupgradeneeded = () => {
			if (!request.result.objectStoreNames.contains(OBJECT_STORE_NAME)) {
				request.result.createObjectStore(OBJECT_STORE_NAME);
			}
		};
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error ?? new Error('Không thể mở kho khóa MyBK.'));
	});
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
	return new Promise((resolve, reject) => {
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error ?? new Error('Không thể truy cập kho khóa MyBK.'));
	});
}

function transactionComplete(transaction: IDBTransaction): Promise<void> {
	return new Promise((resolve, reject) => {
		transaction.oncomplete = () => resolve();
		transaction.onabort = () =>
			reject(transaction.error ?? new Error('Giao dịch kho khóa MyBK bị hủy.'));
		transaction.onerror = () =>
			reject(transaction.error ?? new Error('Giao dịch kho khóa MyBK thất bại.'));
	});
}
