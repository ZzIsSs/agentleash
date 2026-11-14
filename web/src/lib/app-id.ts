// Chép từ starter kit ../privy-agent-wallet/src/lib/app-id.ts.
// Privy app ID là công khai (mọi trình duyệt đều nhận). App secret không nằm ở đây.
export const PRIVY_APP_ID = (process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? "").trim();

// App ID của Privy dài đúng 25 ký tự; PrivyProvider ném lỗi với chuỗi khác và làm trắng trang.
// Kiểm trước để trang hiện hướng dẫn sửa thay vì màn hình lỗi.
export const APP_ID_STATE: "missing" | "malformed" | "ok" = !PRIVY_APP_ID
  ? "missing"
  : PRIVY_APP_ID.length !== 25
    ? "malformed"
    : "ok";
