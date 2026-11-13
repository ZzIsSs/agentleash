# Nhật ký phiên

Mỗi phiên làm việc (của Nguyên hoặc Giang) để lại một file ở đây, tên dạng `YYYY-MM-DD-HHmm-<người>.md`, ví dụ `2026-11-10-1430-giang.md`. Mỗi file ghi: phiên đó làm gì, file nào đã đổi và vì sao, quyết định nào đã chốt, việc gì còn dở, và người sau cần lưu ý gì.

- Muốn biết "lần trước làm tới đâu": đọc 2–3 file mới nhất, hoặc nhờ AI agent "đọc nhật ký phiên".
- Ghi log: gõ `/session-log` trong Claude Code, hoặc nói với agent "ghi nhật ký phiên". Cách làm nằm ở `.claude/skills/session-log/SKILL.md`.
- Không sửa log của người khác. Muốn bổ sung thì ghi vào log phiên của mình.
- Không ghi bí mật (private key, API key, nội dung `.env`) vào log, vì log được đưa lên GitHub.
