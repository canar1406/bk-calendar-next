const frame = document.querySelector<HTMLIFrameElement>('#source');

chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
	if (!message || typeof message !== 'object') return false;
	const value = message as Record<string, unknown>;
	if (value.type !== 'bkalendar:offscreen:navigate' || typeof value.url !== 'string') {
		return false;
	}
	if (!frame) {
		sendResponse({ ok: false, message: 'Không tạo được vùng đọc MyBK ẩn.' });
		return false;
	}
	frame.src = value.url;
	sendResponse({ ok: true });
	return false;
});
