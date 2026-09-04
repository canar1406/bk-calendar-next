import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
	createCredentialVault,
	type EncryptedCredentialRecord,
	type VaultKeyStore,
	type VaultRecordStore
} from '../src/auth/credential-vault.ts';

class MemoryRecordStore implements VaultRecordStore {
	record: EncryptedCredentialRecord | undefined;

	async get(): Promise<EncryptedCredentialRecord | undefined> {
		return this.record ? structuredClone(this.record) : undefined;
	}

	async set(record: EncryptedCredentialRecord): Promise<void> {
		this.record = structuredClone(record);
	}

	async remove(): Promise<void> {
		this.record = undefined;
	}
}

class MemoryKeyStore implements VaultKeyStore {
	key: CryptoKey | undefined;

	async get(): Promise<CryptoKey | undefined> {
		return this.key;
	}

	async set(key: CryptoKey): Promise<void> {
		this.key = key;
	}

	async remove(): Promise<void> {
		this.key = undefined;
	}
}

describe('persistent MyBK credential vault', () => {
	it('encrypts credentials and can reopen them after a browser restart', async () => {
		const records = new MemoryRecordStore();
		const keys = new MemoryKeyStore();
		const firstProcess = createCredentialVault(records, keys);

		await firstProcess.save({
			username: 'student@hcmut.edu.vn',
			password: 'correct horse battery staple'
		});

		const serialized = JSON.stringify(records.record);
		assert.equal(serialized.includes('student@hcmut.edu.vn'), false);
		assert.equal(serialized.includes('correct horse battery staple'), false);
		assert.equal(keys.key?.extractable, false);

		const restartedProcess = createCredentialVault(records, keys);
		assert.deepEqual(await restartedProcess.read(), {
			username: 'student@hcmut.edu.vn',
			password: 'correct horse battery staple'
		});
		assert.equal(await restartedProcess.hasCredentials(), true);
	});

	it('removes both ciphertext and the persistent encryption key', async () => {
		const records = new MemoryRecordStore();
		const keys = new MemoryKeyStore();
		const vault = createCredentialVault(records, keys);

		await vault.save({ username: 'student', password: 'secret' });
		await vault.remove();

		assert.equal(await vault.read(), undefined);
		assert.equal(await vault.hasCredentials(), false);
		assert.equal(records.record, undefined);
		assert.equal(keys.key, undefined);
	});

	it('rejects empty credentials without writing a record', async () => {
		const records = new MemoryRecordStore();
		const vault = createCredentialVault(records, new MemoryKeyStore());

		await assert.rejects(
			() => vault.save({ username: 'student', password: '   ' }),
			/Mật khẩu MyBK không được để trống/
		);
		assert.equal(records.record, undefined);
	});
});
