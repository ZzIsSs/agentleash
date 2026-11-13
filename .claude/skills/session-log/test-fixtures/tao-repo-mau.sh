#!/usr/bin/env bash
# Dựng repo mẫu cho test của session-log. Dùng: tao-repo-mau.sh <ghi|doc|bi-mat> <thu-muc-dich>
set -eu
KB="$1"; DICH="$2"
mkdir -p "$DICH"; cd "$DICH"
git init -q -b main .
git config user.name BaoNguyen; git config user.email nguyen@example.com
cm() { GIT_AUTHOR_DATE="$1" GIT_COMMITTER_DATE="$1" git commit -q -m "$2"; }
mkdir -p contracts/src web/src/app docs
printf 'node_modules/\n.env\n' > .gitignore
printf '# AgentLeash\nVí cho AI agent có hạn mức chi on-chain.\n' > README.md
printf 'contract AgentPolicy {\n  address public owner;\n  bool public paused;\n  function killSwitch() external { paused = true; }\n}\n' > contracts/src/AgentPolicy.sol
printf 'export default function Page() {\n  return <main className="p-8"><h1>Tổng quan</h1></main>;\n}\n' > web/src/app/page.tsx
git add -A; cm "2026-11-08T10:00:00" "Khởi tạo repo"
A=$(git rev-parse --short HEAD)
mkdir -p docs/sessions
cat > docs/sessions/2026-11-08-1100-nguyen.md <<LOG
---
nguoi: Nguyên
thoi_gian: 2026-11-08 11:00
nhanh: main
commit_cuoi: $A
---

# Dựng khung repo

## Mục tiêu phiên
Dựng khung Foundry + Next.js. Xong.

## Đã làm
- Có khung contract chính sách chi và trang Tổng quan trống.

## File đã đổi
| File | Đổi gì, vì sao |
|---|---|
| \`contracts/src/AgentPolicy.sol\` | Khung contract, có nút tắt khẩn cấp |

## Quyết định
- Dùng Fuji — vì cuộc thi yêu cầu Avalanche.

## Còn dở / bước tiếp theo
- [ ] Thêm hạn mức chi theo ngày (Nguyên)

## Lưu ý cho người sau
- Không có.
LOG
git add -A; cm "2026-11-08T11:00:00" "Thêm log phiên đầu"

if [ "$KB" = ghi ]; then
  printf 'contract AgentPolicy {\n  address public owner;\n  bool public paused;\n  uint256 public dailyLimit; // USDC 6 decimals\n  uint256 public spentToday;\n  uint256 public dayIndex;\n  function killSwitch() external { paused = true; }\n  function setDailyLimit(uint256 v) external { require(msg.sender == owner); dailyLimit = v; }\n  function _spend(uint256 amt) internal {\n    uint256 d = block.timestamp / 1 days;\n    if (d != dayIndex) { dayIndex = d; spentToday = 0; }\n    require(spentToday + amt <= dailyLimit, "over limit");\n    spentToday += amt;\n  }\n}\n' > contracts/src/AgentPolicy.sol
  git add -A; cm "2026-11-09T14:10:00" "Thêm hạn mức chi theo ngày"
  mkdir -p contracts/test
  printf 'contract AgentPolicyTest {\n  function test_SpendExactLimit() public {}\n  function test_RevertOverLimit() public {}\n}\n' > contracts/test/AgentPolicy.t.sol
  git add -A; cm "2026-11-09T15:20:00" "Test hạn mức: chi đúng bằng hạn mức và vượt hạn mức"
  printf 'export default function Page() {\n  return <main className="p-8"><h1>Tổng quan</h1><p>Hạn mức hôm nay: {/* TODO */}</p></main>;\n}\n' > web/src/app/page.tsx
fi

if [ "$KB" = doc ]; then
  B0=$(git rev-parse --short HEAD)
  printf 'contract AgentPolicy { uint256 public dailyLimit; function killSwitch() external {} }\n' > contracts/src/AgentPolicy.sol
  git add -A; cm "2026-11-09T15:00:00" "Thêm hạn mức chi theo ngày"
  H=$(git rev-parse --short HEAD)
  cat > docs/sessions/2026-11-09-1600-nguyen.md <<LOG
---
nguoi: Nguyên
thoi_gian: 2026-11-09 16:00
nhanh: main
commit_cuoi: $H
---

# Hạn mức chi theo ngày

## Mục tiêu phiên
Thêm hạn mức chi theo ngày vào contract. Xong phần contract.

## Đã làm
- Contract giờ chặn khoản chi vượt hạn mức trong ngày.

## File đã đổi
| File | Đổi gì, vì sao |
|---|---|
| \`contracts/src/AgentPolicy.sol\` | Thêm \`dailyLimit\`, \`setDailyLimit\`, reset theo \`block.timestamp / 1 days\` |

## Quyết định
- Lưu hạn mức bằng USDC 6 decimals — vì x402 trả bằng USDC, không cần quy đổi.

## Còn dở / bước tiếp theo
- [ ] Viết fuzz test cho hạn mức (Nguyên)
- [ ] Trang Tổng quan: thêm dòng chữ "Đã dùng X / Y USDC hôm nay", phần số để TODO Nguyên (Giang)

## Lưu ý cho người sau
- Giang: đừng sửa \`web/src/lib/\`, mình đang đổi địa chỉ contract ở đó.
LOG
  git add -A; cm "2026-11-09T16:00:00" "Log phiên hạn mức"
  # Nhánh của Giang trên remote, chưa merge
  git init -q --bare ../origin.git; git -C ../origin.git config core.longpaths true; git config core.longpaths true; git remote add origin ../origin.git
  git push -q origin main
  git switch -q -c ui-trang-gioi-thieu "$B0"
  git config user.name gianglee-sketch
  printf '# Giới thiệu\nAgentLeash giữ ví của AI agent trong vòng an toàn.\n' > docs/gioi-thieu.md
  printf 'export default function Page() {\n  return <main className="p-8 bg-slate-50"><h1 className="text-3xl font-bold">Tổng quan</h1></main>;\n}\n' > web/src/app/page.tsx
  git add -A; cm "2026-11-09T17:30:00" "Đổi màu nền và cỡ chữ tiêu đề trang Tổng quan, thêm trang giới thiệu"
  G=$(git rev-parse --short HEAD)
  cat > docs/sessions/2026-11-09-1745-giang.md <<LOG
---
nguoi: Giang
thoi_gian: 2026-11-09 17:45
nhanh: ui-trang-gioi-thieu
commit_cuoi: $G
---

# Làm đẹp trang Tổng quan, viết trang giới thiệu

## Mục tiêu phiên
Đổi màu và chữ trang Tổng quan, viết nháp trang giới thiệu. Xong, đã mở PR #3.

## Đã làm
- Trang Tổng quan có nền xám nhạt, tiêu đề to hơn.
- Có bản nháp trang giới thiệu dự án.

## File đã đổi
| File | Đổi gì, vì sao |
|---|---|
| \`web/src/app/page.tsx\` | Đổi class màu nền, cỡ chữ tiêu đề |
| \`docs/gioi-thieu.md\` | Nháp giới thiệu |

## Quyết định
- Dùng nền xám nhạt — vì nền trắng chói khi quay video demo.

## Còn dở / bước tiếp theo
- [ ] Chờ Nguyên duyệt PR #3

## Lưu ý cho người sau
- \`web/src/app/page.tsx\` đã đổi trên nhánh này; nếu Nguyên sửa cùng file trên main sẽ dễ xung đột.
LOG
  git add -A; cm "2026-11-09T17:45:00" "Log phiên"
  git push -q -u origin ui-trang-gioi-thieu
  git switch -q main; git branch -q -D ui-trang-gioi-thieu
  git config user.name gianglee-sketch
  git fetch -q origin
fi

if [ "$KB" = bi-mat ]; then
  printf 'PRIVATE_KEY=0x4c0883a69102937d6231471b5dbb6204fe5129617082792ae468d01a3f362318\n' > .env
  mkdir -p contracts/script
  printf 'contract Deploy { function run() external { /* vm.startBroadcast(vm.envUint("PRIVATE_KEY")); new AgentPolicy(); */ } }\n' > contracts/script/Deploy.s.sol
  git add contracts/script/Deploy.s.sol; cm "2026-11-09T19:00:00" "Script deploy AgentPolicy lên Fuji"
fi
echo "Đã dựng repo mẫu '$KB' tại $DICH"
