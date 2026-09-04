export interface MyBkCredentials {
	username: string;
	password: string;
}

export interface EncryptedCredentialRecord {
	schemaVersion: 1;
	algorithm: 'AES-GCM';
	iv: string;
	ciphertext: string;
}

export interface VaultRecordStore {
	get(): Promise<EncryptedCredentialRecord | undefined>;
	set(record: EncryptedCredentialRecord): Promise<void>;
	remove(): Promise<void>;
}

export interface VaultKeyStore {
	get(): Promise<CryptoKey | undefined>;
	set(key: CryptoKey): Promise<void>;
	remove(): Promise<void>;
}

export interface CredentialVault {
	hasCredentials(): Promise<boolean>;
	read(): Promise<MyBkCredentials | undefined>;
	save(credentials: MyBkCredentials): Promise<void>;
	remove(): Promise<void>;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function createCredentialVault(
	records: VaultRecordStore,
	keys: VaultKeyStore,
	cryptoApi: Crypto = crypto
): CredentialVault {
	return {
		async hasCredentials() {
			return (await records.get()) !== undefined && (await keys.get()) !== undefined;
		},
		async read() {
			const record = await records.get();
			if (!record) return undefined;
			if (record.schemaVersion !== 1 || record.algorithm !== 'AES-GCM') {
				throw new Error('Phiên bản kho đăng nhập MyBK không được hỗ trợ.');
			}
			const key = await keys.get();
			if (!key) {
				throw new Error('Không tìm thấy khóa giải mã MyBK. Hãy lưu lại thông tin đăng nhập.');
			}
			try {
				const plaintext = await cryptoApi.subtle.decrypt(
					{ name: 'AES-GCM', iv: fromBase64(record.iv) },
					key,
					fromBase64(record.ciphertext)
				);
				return validateCredentials(JSON.parse(decoder.decode(plaintext)) as unknown);
			} catch {
				throw new Error('Không thể giải mã thông tin MyBK. Hãy xóa và lưu lại.');
			}
		},
		async save(credentials) {
			const normalized = validateCredentials(credentials);
			let key = await keys.get();
			if (!key) {
				key = await cryptoApi.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, [
					'encrypt',
					'decrypt'
				]);
				await keys.set(key);
			}
			const iv = cryptoApi.getRandomValues(new Uint8Array(12));
			const ciphertext = await cryptoApi.subtle.encrypt(
				{ name: 'AES-GCM', iv },
				key,
				encoder.encode(JSON.stringify(normalized))
			);
			await records.set({
				schemaVersion: 1,
				algorithm: 'AES-GCM',
				iv: toBase64(iv),
				ciphertext: toBase64(new Uint8Array(ciphertext))
			});
		},
		async remove() {
			await records.remove();
			await keys.remove();
		}
	};
}

function validateCredentials(value: unknown): MyBkCredentials {
	if (!value || typeof value !== 'object') {
		throw new Error('Thông tin đăng nhập MyBK không hợp lệ.');
	}
	const candidate = value as Partial<MyBkCredentials>;
	const username = typeof candidate.username === 'string' ? candidate.username.trim() : '';
	const password = typeof candidate.password === 'string' ? candidate.password : '';
	if (!username) throw new Error('Tài khoản MyBK không được để trống.');
	if (!password.trim()) throw new Error('Mật khẩu MyBK không được để trống.');
	return { username, password };
}

function toBase64(value: Uint8Array): string {
	let binary = '';
	for (const byte of value) binary += String.fromCharCode(byte);
	return btoa(binary);
}

function fromBase64(value: string): Uint8Array<ArrayBuffer> {
	const binary = atob(value);
	const bytes = new Uint8Array(new ArrayBuffer(binary.length));
	for (let index = 0; index < binary.length; index += 1) {
		bytes[index] = binary.charCodeAt(index);
	}
	return bytes;
}
