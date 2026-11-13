---
name: session-log
description: Nhật ký phiên làm việc của nhóm AgentLeash. Cuối phiên, ghi lại những gì đã thay đổi (file, quyết định, việc còn dở, lưu ý cho người sau) vào docs/sessions/. Đầu phiên, đọc log gần nhất của cả nhóm và tóm tắt "phiên trước để lại gì". Dùng khi người dùng gõ /session-log, nói "ghi log", "ghi nhật ký phiên", "tổng kết phiên", "xong rồi, lưu lại", "bàn giao", "kết thúc phiên"; và khi họ hỏi "phiên trước làm gì", "Giang/Nguyên đã đổi gì", "có gì mới không", "bắt đầu làm tiếp", kể cả khi không nhắc chữ "log". Cũng dùng khi hook nhắc chưa ghi log.
---

# Nhật ký phiên (session-log)

Nhóm AgentLeash có hai người làm xen kẽ trên cùng repo: **Nguyên** (phụ trách kỹ thuật, GitHub `ZzIsSs`, git user `BaoNguyen`) và **Giang** (không đọc code, dùng một AI agent bất kỳ, GitHub `gianglee-sketch`, chỉ được sửa vùng ghi ở AGENTS.md). Mỗi phiên mới thường phải hỏi lại "lần trước đổi gì, còn dở gì". Skill này giải quyết việc đó: cuối phiên để lại một ghi chú bàn giao ngắn, đầu phiên đọc ghi chú của người trước.

Log là một file Markdown cho mỗi phiên trong `docs/sessions/`. Mỗi phiên một file riêng, vì hai người cùng sửa một file chung sẽ xung đột khi merge.

Script hỗ trợ (chỉ đọc git, không sửa gì): `node .claude/skills/session-log/scripts/thu-thap.mjs <ghi|doc|kiem-tra>`. Chạy từ thư mục gốc repo.

Đọc yêu cầu để biết người dùng cần chế độ nào. "Ghi log", "xong rồi" là **Ghi**. "Có gì mới", "bắt đầu làm" là **Đọc**. Nếu không rõ, cứ hỏi một câu.

## Chế độ Ghi (cuối phiên)

1. **Thu thập dữ kiện.** Chạy `node .claude/skills/session-log/scripts/thu-thap.mjs ghi`. Kết quả gồm: thời gian, nhánh, HEAD, các commit kể từ log trước, các file chưa commit và tên file gợi ý. Script không đọc nội dung `.env`. Nếu script báo file nhạy cảm thì chỉ ghi tên file, không mở file đó.

2. **Xác định người làm.** Lấy từ cuộc hội thoại nếu đã rõ. Nếu chưa, đoán từ git user (`BaoNguyen` là Nguyên). Không đoán được thì hỏi. Phần `<nguoi>` trong tên file viết thường, không dấu: `nguyen`, `giang`.

3. **Lấy phần "vì sao" từ cuộc hội thoại.** Git chỉ cho biết file nào đổi. Giá trị thật của log nằm ở mục tiêu phiên, quyết định kèm lý do, cách đã thử rồi bỏ, việc còn dở, và những thứ đó chỉ có trong cuộc trò chuyện. Hãy đọc lại hội thoại để rút ra. Nếu hội thoại không cho biết mục tiêu hoặc việc còn dở, hỏi người dùng **một lần**, gộp mọi câu vào một tin nhắn. Nếu họ muốn ghi nhanh thì ghi những gì đang có và để trống phần thiếu, đừng bịa.

4. **Viết log** theo mẫu `assets/template.md` vào `docs/sessions/<YYYY-MM-DD-HHmm>-<nguoi>.md` (lấy thời gian từ script). Tạo thư mục nếu chưa có. Cách viết:
   - Viết tiếng Việt, câu ngắn. Mục **Đã làm** viết sao cho Giang đọc hiểu được: tả cái người dùng nhìn thấy hoặc kết quả, không dùng tên hàm, hook, biến. Chi tiết kỹ thuật đặt ở **File đã đổi** và **Quyết định**, vì Nguyên cần chúng.
   - **File đã đổi**: mỗi file hoặc nhóm file liên quan một dòng "đổi gì, vì sao". Đừng chép nguyên `git status`. Gộp các file sinh tự động (lock, build) thành một dòng hoặc bỏ đi.
   - **Còn dở / bước tiếp theo**: dùng checkbox, mỗi việc đủ cụ thể để người khác bắt tay làm ngay ("viết test cho killSwitch khi đã chạm hạn mức", không phải "làm thêm test").
   - **Lưu ý cho người sau**: file đang sửa dở hoặc chưa commit, chỗ dễ xung đột (hai người cùng đụng một file), việc cần Nguyên duyệt hoặc merge, lệnh cần chạy lại (ví dụ `npm install` vì có gói mới). Mục này giúp người sau tránh dẫm chân nhau, nên đừng bỏ qua.
   - `commit_cuoi` là hash HEAD script đưa ra. Lần ghi sau dựa vào nó để biết commit nào là mới.
   - Không chép giá trị bí mật nào vào log (private key, `0x` + 64 hex, API key, app secret, nội dung `.env`). Log sẽ lên GitHub.

5. **Kiểm tra.** Chạy `node .claude/skills/session-log/scripts/thu-thap.mjs kiem-tra <file-log>`. Nếu script báo KHÔNG ỔN, xóa chuỗi đó khỏi log rồi chạy lại.

6. **Báo người dùng** trong vài dòng: đường dẫn file log, 2–3 ý chính, và việc còn lại là đưa file log vào commit của nhánh đang làm để người kia thấy được, ví dụ `git add docs/sessions/<file>` rồi commit cùng phần việc. Skill **không tự commit, push hay mở PR**, vì repo có quy trình riêng: Giang làm trên nhánh và mở PR, chỉ Nguyên merge vào `main`. Nếu người dùng nhờ commit thì làm theo AGENTS.md (không commit thẳng lên `main` khi là Giang).

Nếu không có thay đổi nào (không commit mới, `git status` sạch) và hội thoại cũng không có quyết định gì đáng ghi, nói điều đó với người dùng và hỏi họ có muốn ghi không. Một log rỗng chỉ gây nhiễu.

## Chế độ Đọc (đầu phiên)

1. Chạy `node .claude/skills/session-log/scripts/thu-thap.mjs doc` (thêm số nếu cần nhiều hơn 3 log, ví dụ `doc 6`). Script in các log gần nhất trên nhánh hiện tại, kèm log trên các nhánh remote chưa merge, ví dụ Giang đang làm trên nhánh riêng. Thông tin nhánh khác lấy theo lần `git fetch` gần nhất. Nếu lần fetch đã cũ, đề nghị người dùng chạy `git pull` hoặc `git fetch` (Giang cần được hỏi trước theo AGENTS.md).

2. Tóm tắt trong **tối đa 5 dòng**, mở đầu bằng "Phiên trước để lại cho bạn:". Ưu tiên theo thứ tự:
   1. Việc còn dở liên quan tới người đang hỏi.
   2. Lưu ý về xung đột hoặc file đang sửa dở.
   3. Việc chờ Nguyên duyệt.
   4. Thay đổi đáng biết của người kia.

   Ghi rõ ai làm, khi nào. Nếu người đang hỏi là Giang, viết bằng lời thường và bỏ chi tiết code.

3. Nếu chưa có log nào, nói thẳng như vậy và gợi ý xem `git log` hoặc hỏi người kia, thay vì tự dựng câu chuyện từ commit.

Sau khi tóm tắt, quay lại việc người dùng định làm. Đừng tự bắt đầu những việc trong mục "còn dở" khi họ chưa yêu cầu.

## Ví dụ một mục "Đã làm" và "Còn dở" tốt

```markdown
## Đã làm
- Contract giờ chặn mọi khoản chi vượt hạn mức trong ngày; đã có test cho trường hợp chi đúng bằng hạn mức.

## Còn dở / bước tiếp theo
- [ ] Viết test fuzz cho hạn mức theo ngày (Nguyên)
- [ ] Trang Tổng quan: thêm dòng chữ "Đã dùng X / Y USDC hôm nay" (Giang làm được, phần số liệu để TODO Nguyên)
```
