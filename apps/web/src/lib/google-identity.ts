import type { GoogleIdentityApi } from '../../../../packages/google-calendar/src/oauth.ts';

const GIS_SCRIPT_URL = 'https://accounts.google.com/gsi/client';
const GIS_SCRIPT_ATTRIBUTE = 'data-bkalendar-google-identity';

export interface GoogleIdentityScriptCallbacks {
	onLoad(): void;
	onError(): void;
}

export interface GoogleIdentityLoaderEnvironment {
	getIdentity(): GoogleIdentityApi | undefined;
	appendScript(callbacks: GoogleIdentityScriptCallbacks): void;
}

export async function loadGoogleIdentity(
	environment: GoogleIdentityLoaderEnvironment = createBrowserEnvironment()
): Promise<GoogleIdentityApi> {
	const loaded = environment.getIdentity();
	if (loaded) return loaded;

	return await new Promise<GoogleIdentityApi>((resolve, reject) => {
		environment.appendScript({
			onLoad() {
				const identity = environment.getIdentity();
				if (identity) {
					resolve(identity);
					return;
				}
				reject(new Error('Google Identity Services đã tải nhưng không khởi tạo được.'));
			},
			onError() {
				reject(new Error('Không thể tải Google Identity Services. Hãy kiểm tra kết nối mạng.'));
			}
		});
	});
}

function createBrowserEnvironment(): GoogleIdentityLoaderEnvironment {
	return {
		getIdentity() {
			return (window as Window & { google?: GoogleIdentityApi }).google;
		},
		appendScript(callbacks) {
			const existing = document.querySelector<HTMLScriptElement>(`script[${GIS_SCRIPT_ATTRIBUTE}]`);
			if (existing) {
				existing.addEventListener('load', callbacks.onLoad, { once: true });
				existing.addEventListener('error', callbacks.onError, { once: true });
				return;
			}

			const script = document.createElement('script');
			script.src = GIS_SCRIPT_URL;
			script.async = true;
			script.defer = true;
			script.setAttribute(GIS_SCRIPT_ATTRIBUTE, '');
			script.addEventListener('load', callbacks.onLoad, { once: true });
			script.addEventListener('error', callbacks.onError, { once: true });
			document.head.append(script);
		}
	};
}
