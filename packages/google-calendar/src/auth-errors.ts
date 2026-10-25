export class GoogleOAuthError extends Error {
	readonly code: string;
	readonly requiresProjectOwner: boolean;

	constructor(code: string, detail = '') {
		const combined = `${code} ${detail}`;
		const userLimit = /rate_limit_exceeded|user_limit|sign.?in limit|too many users/iu.test(
			combined
		);
		const configuration =
			/redirect_uri_mismatch|invalid_client|unauthorized_client|org_internal|admin_policy_enforced/iu.test(
				combined
			);
		let message: string;
		if (userLimit) {
			message =
				'Google đang giới hạn số người đăng nhập ứng dụng. Mình cần kiểm tra Google Cloud → Google Auth Platform → Audience và Verification Center, thêm tài khoản thử nghiệm hoặc hoàn tất xác minh. Đăng nhập lại liên tục không gỡ được giới hạn này.';
		} else if (code === 'popup_closed') {
			message = 'Bạn đã đóng cửa sổ đăng nhập Google. Có thể bấm đồng bộ để thử lại.';
		} else if (code === 'popup_failed_to_open') {
			message = 'Trình duyệt chặn cửa sổ Google. Hãy cho phép pop-up của BKalendar rồi bấm lại.';
		} else if (code === 'access_denied') {
			message =
				'Google chưa cấp quyền. Nếu ứng dụng còn ở chế độ Testing, mình cần thêm email này vào Test users trong Google Cloud. Nếu tài khoản trường bị chặn, hãy liên hệ quản trị Google Workspace.';
		} else if (configuration) {
			message =
				'Vui lòng chọn tài khoản email trường Bách Khoa (@hcmut.edu.vn) hoặc kiểm tra Authorized JavaScript origins / redirect URI trong Google Cloud.';
		} else {
			message = detail || 'Không thể hoàn tất đăng nhập Google. Hãy thử lại sau.';
		}
		super(
			`${message}${detail && !message.includes(detail) ? ` Chi tiết: ${detail}` : ''} [${code}]`
		);
		this.name = 'GoogleOAuthError';
		this.code = code;
		this.requiresProjectOwner = userLimit || configuration || code === 'access_denied';
	}
}
