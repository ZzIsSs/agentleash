# Phân tích Frontend tham khảo: SKY (`nasa.taquangkhoi.com`) & Phương án áp dụng cho AgentLeash

> **Nguồn tham khảo:** [Sky, the clinical assistant for astronauts | NASA Space Apps 2026 HCMC](https://nasa.taquangkhoi.com/)  
> **Ngày phân tích:** 19/11/2026  
> **Đối chiếu dự án:** [DESIGN.md](../DESIGN.md) · [Dashboard.tsx](../web/src/components/Dashboard.tsx) · [globals.css](../web/src/app/globals.css) · [FIGMA_UI_2_BAN_SO_SANH.md](FIGMA_UI_2_BAN_SO_SANH.md)

---

## 1. Tổng quan ngôn ngữ thiết kế ("Mission Control HUD")

Giao diện của **SKY (Astronaut Wellness)** tạo cảm giác giống một bảng điều khiển trạm không gian / y khoa hiện đại nhờ 4 trụ cột thiết kế:

1. **Một khung hình vừa khít viewport (`100dvh`, không cuộn dọc trên desktop):** Trên màn hình `>= 1101px`, trang `/` khóa chiều cao đúng bằng màn hình (`min-[1101px]:h-dvh min-[1101px]:overflow-hidden`), giúp toàn bộ hệ thống trông như một buồng lái vận hành (console) thay vì một trang web đọc tin.
2. **Bố cục 3 cột bất đối xứng có "nhân vật trung tâm":** Thay vì chia đều 4 thẻ 2×2 ngang hàng nhau, cột giữa được giải phóng làm tiêu điểm thị giác (quả cầu hạt phát sáng + lời chào mảnh + nút tương tác chính), đẩy các chỉ số phụ và chi tiết về 2 cột hai bên.
3. **Glassmorphism & Ánh sáng có kiểm soát:** Nền sử dụng radial gradient sâu (`#0c3159 → #010812`), card kính mờ (`backdrop-filter: blur(8px)`) kèm viền ice-cyan mảnh `1px`. Hiệu ứng viền gradient cyan→tím và glow chỉ dùng cho **2–3 nút/hộp tương tác trung tâm**, không rải đều khắp màn hình.
4. **Phân lớp thông tin (Progressive Disclosure):** Trang `/` chỉ giữ trạng thái tổng quan và hành động nhanh. Dữ liệu dài và chuyên sâu (15 kết quả lâm sàng, biểu đồ 30 ngày, giải phẫu 3D chi tiết, tài liệu ML) được đẩy sang các sub-route (`/performance`, `/body`, `/watch`, `/spacecraft`, `/research`, `/data`) và modal (`Ctrl + K`).

---

## 2. Kiến trúc kỹ thuật & Design Tokens quan sát từ SKY

### 2.1. Tech Stack thực tế
- **Framework & Build:** React 19 + TanStack Start / TanStack Router + Vite (Rolldown) + **Tailwind CSS v4.3.5**.
- **Icon & Animation:** `lucide-react` (34 inline SVGs trên `/`) + `framer-motion` (tích hợp `use-reduced-motion` và CSS `prefers-reduced-motion: reduce`).
- **Đồ họa / Trực quan:** `three.js` + `GLTFLoader` (4 `<canvas>` trên `/`: nền sao, quả cầu hạt trung tâm, bản preview 3D giải phẫu) + inline SVG (vòng radial, sparkline, sóng âm).
- **Font:** Không nạp Google Fonts (`fontFaces: []`); dùng hệ thống sans/mono (`Inter, Manrope, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif` và `ui-monospace`).
- **Đa ngôn ngữ:** Hỗ trợ chuyển `EN | VI` qua query (`?lang=en` / `?lang=vi`).

### 2.2. Bảng màu & CSS Tokens (`:root` và styles trên DOM)

| Thành phần | Giá trị CSS quan sát trên SKY | Ghi chú ứng dụng |
| :--- | :--- | :--- |
| **Root background (`--sky-bg`)** | `#070b14` + 2 radial glow (`#5eead41a` góc trên phải, `#6366f11a` bên trái) | Tạo chiều sâu nền thay cho đen bệt. |
| **App Shell (`<main>`)** | `radial-gradient(ellipse 95% 90% at 52% -8%, #0c3159 0%, #091c32 49%, #04111f 78%, #010812 100%)` | Vùng sáng tập trung ngay sau cụm trung tâm. |
| **Surface tokens** | `--sky-bg-raised: #0d1424`, `--sky-surface: #111a2e`, `--sky-surface-2: #17223b`, `--sky-border: #243252` | Các lớp slate-navy đồng bộ sắc độ lạnh. |
| **Glass Panel / Card** | `border-radius: 18px`, `border: 1px solid rgba(122, 222, 255, 0.15)`, `background: linear-gradient(160deg, rgba(13, 31, 54, 0.86), rgba(7, 18, 33, 0.92))`, `box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04)`, `backdrop-filter: blur(8px)` | Đường highlight `inset 0 1px 0` giúp cạnh trên của card bắt sáng rất tinh tế. |
| **Text colors** | `--sky-text: #e8eef9`, `--sky-muted: #9aa9c4`, `--text-muted: #7e8dab` | Chữ chính trắng ánh xanh rất nhẹ, không gắt `#ffffff`. |
| **Accent & Semantic** | `--sky-accent: #5eead4`, `--sky-green: #4ade80`, `--sky-yellow: #fbbf24`, `--sky-red: #f87171`, `--info: #7dd3fc` | Cyan-teal làm màu định hướng, xanh/vàng/đỏ chỉ dùng cho trạng thái. |
| **Header** | Cao `~88px` (ở `1440×900`), `padding: 12px 24px`, `border-bottom: 1px solid rgba(122, 222, 255, 0.12)` | Gọn, đường ngăn mảnh suốt chiều ngang. |
| **Hero Greeting (`<h1>`)** | `clamp(19px, 2vw, 28px)`, `font-weight: 300` (`font-light`), `line-height: 1.25`, `letter-spacing: 0.013em`, `#ecf7ff`, `text-shadow: 0 2px 23px rgba(10, 25, 62, 0.6)` | Nét chữ mảnh tạo cảm giác tinh gọn, cao cấp. |
| **Section Header (`<h2>`)** | `11px`, `font-weight: 500`, `uppercase`, `letter-spacing: 0.2em`, `#a8d8f0` | Nhãn nhỏ, khoảng chữ rộng kiểu thiết bị hàng không. |
| **Sub-label (`<h3>`)** | `9.5px`, `uppercase`, `letter-spacing: 0.14em`, `#8fb8d4`, icon `12px` màu `#7fe0ff` | Khá nhỏ — cần cân nhắc phóng lớn lên khi dùng tiếng Việt. |
| **CTA chính (`Speak to Sky`)** | Tròn `84×84px`, `box-shadow: 0 0 28px 2px rgba(94, 234, 212, 0.22), 0 0 10px rgba(120, 234, 255, 0.25)` | Nút trọng tâm duy nhất có hào quang tròn. |
| **Pill viền gradient (`Type instead Ctrl K`)** | `height: 56px`, `rounded-full`, `padding: 0 26px`, `background: linear-gradient(180deg, rgba(10,22,44,0.72), rgba(9,19,38,0.72)) padding-box, linear-gradient(90deg, rgba(92,240,208,0.55), rgba(179,114,255,0.55)) border-box`, glow `0 0 22px rgba(94,240,214,0.12), 0 0 44px rgba(150,104,255,0.1)` | Kỹ thuật `padding-box` + `border-box` tạo viền chuyển sắc cyan→tím sắc nét trên nút bo tròn. |
| **Tab pills** | `rounded-full`, `padding: 6px 10px`, `10px`, `letter-spacing: 0.12em`; Active: `border: rgba(140,231,255,0.5)`, `background: rgba(120,234,255,0.12)`, `color: #d9f6ff`, `box-shadow: inset 0 0 0 1px rgba(140,231,255,0.25)` | Nhẹ hơn tab đặc truyền thống. |

---

## 3. Giải phẫu bố cục không gian & Responsive

### 3.1. Bố cục Desktop (`>= 1101px`, `max-w-[1720px]`, `gap-5`)

```text
+---------------------------------------------------------------------------------------------------+
| HEADER (88px): [Logo + SKY / Astronaut Wellness]     [ISS · Day 170] [Console|Watch] [EN|VI] [SPACECRAFT] [NOTEBOOKS] |
+------------------------------+-----------------------------------+--------------------------------+
| CỘT TRÁI (400px)             | CỘT GIỮA (minmax(0, 1fr))         | CỘT PHẢI (560px)               |
|                              |                                   |                                |
| [Card 1: Astronaut Profile]  |                                   | [Card 1: Overall Readiness]    |
| - Badge SIMULATED TELEMETRY  |       (Canvas Particle Orb)       | - SVG Radial Ring (86 / 100)   |
| - Avatar tròn + Name + Role  |                                   | - Status: Stable (#60efc0)     |
| - Nút [CHANGE ASTRONAUT]     |    "Good morning, Ayla."          | - Recovery Index 96/100 (+4)   |
|                              |     How are you feeling today?    | - 1 dòng khuyến nghị trạng thái|
| [Card 2: Vital Signs]        |                                   |                                |
| - 6 hàng chỉ số live:        |     ~ ~ ~ VoiceWaveform ~ ~ ~     | [Card 2: Readiness Details]    |
|   Icon | Tên | Số | Sparkline|                                   | - Tabs: [BODY][RECOVERY]       |
|   (HR, HRV, BP, Resp, SpO2,  |        (( Speak to Sky ))         |         [COGNITIVE][ENERGY]    |
|    Temp)                     |             84x84px               | - Trái: 3D preview / visual    |
|                              |                                   | - Phải: 4 thanh progress       |
| [Card 3: Quick Trends]       |    [ Type instead   Ctrl K ]      |         gradient ngang         |
| - Heart Rate (line)          |                                   |                                |
| - Sleep (khối màu phân đoạn) |  [Open Human Performance pill]    | [Dải 3 KPI đáy]                |
| - Activity (bar histogram)   |  "Your sleep was 7h 42m..."       | [Activity] [Burned] [Intake]   |
+------------------------------+-----------------------------------+--------------------------------+
|                         [SKY composed this layout · tap to dismiss x]                             |
+---------------------------------------------------------------------------------------------------+
```

### 3.2. Breakpoints & Sub-routes
- **Tablet (`721px–1100px`):** Grid đổi thành 2 cột `[minmax(0,400px)_minmax(0,1fr)]` cho Trái + Giữa, còn cột Phải rớt xuống hàng 2 và kéo dài hết 2 cột (`'left center' 'right right'`), cho phép cuộn dọc.
- **Mobile (`390×844`):** Đường dẫn `/` tự động chuyển sang giao diện **Watch view** (carousel 3 trang vuốt ngang với chấm phân trang: *Vitals 2×2*, *Wellness*, *Sky*), vừa khít `100vh` không tràn ngang.
- **Modals & Sub-routes trên SKY:**
  - `CREW ROSTER` (modal chọn phi hành gia khi mới mở trang hoặc bấm `CHANGE ASTRONAUT`).
  - `Type a message` (`560px` wide glass modal mở bằng `Ctrl+K`, viền gradient cyan→tím).
  - `/performance` (chi tiết 6 live tiles + lưới 3×4 biểu đồ 30 ngày + 15 clinical findings + citations).
  - `/body`, `/spacecraft` (trình xem 3D toàn màn hình kèm layer toggles).
  - `/watch` (khung đồng hồ thông minh đặt trên nền đường đồng mức địa hình).
  - `/research`, `/data` (tài liệu dataset & pipeline ML). *(Lưu ý: `/notebooks` trỏ iframe `/marimo/` hiện trả 404 trên bản deploy).*

---

## 4. Đối chiếu SKY vs. AgentLeash hiện tại

| Tiêu chí | SKY (`nasa.taquangkhoi.com`) | AgentLeash hiện tại (`web/` & `DESIGN.md`) | Nhận xét chuyển đổi |
| :--- | :--- | :--- | :--- |
| **Tech Stack** | React 19 + Vite + Tailwind CSS v4 | **Next.js 15 + React 19 + Tailwind CSS v4** | Cùng React 19 + Tailwind v4 → tái hiện được gần như 100% CSS mà **không cần thêm package**. |
| **Nền & Ánh sáng** | Nền radial vũ trụ `#0c3159 → #010812` + glow nhạt | Nền phẳng `#020617` (`--background`) | Nâng cấp được ngay trong `globals.css` bằng lớp radial gradient nhẹ phía trên. |
| **Bề mặt Card** | Glass mờ `18px`, gradient tối, viền cyan `15%`, vạch sáng cạnh trên | Phẳng `#0f172a`, `rounded-xl` (`12px`), `border-[#1e293b]`, không blur/shadow | Đổi token card sang kính mờ nhẹ vẫn giữ được độ tương phản nếu opacity nền `>= 0.85`. |
| **Bố cục Desktop** | 3 cột bất đối xứng `100dvh` (`[400 \| 1fr \| 560]`) | Lưới 2×2 cuộn (`Overview` 5 + `Spends` 7; `Setup` 6 + `Rejections` 6) + `DemoControlBar` ngang | Có thể giữ nguyên 4 component hiện có và sắp lại thành 3 cột, hoặc chỉ giữ 2×2 nhưng áp "skin" HUD. |
| **Điểm nhấn đồ họa** | Particle Sphere `<canvas>` + 3D GLB | Sơ đồ SVG thuần `SpendFlowDiagram` (`SpendsPanel.tsx`) | **Không nên cài Three.js.** Nâng cấp SVG topology + thêm SVG radial ring cho `OverviewPanel` là đủ ấn tượng và cực nhẹ. |
| **Typography** | Stack hệ thống, `h1` light, `h2` `11px` tracked | `Be Vietnam Pro` + `JetBrains Mono` (`tabular-nums`) | **Phải giữ `Be Vietnam Pro` + `JetBrains Mono`** để dấu tiếng Việt và cột số USDC/đếm ngược không bị lỗi hoặc giật. |
| **Màu ngữ nghĩa** | Teal-cyan + xanh/vàng/đỏ + gradient cyan→tím cho AI | 4 màu cứng: Xanh lá (`Whitelist`), Vàng (`Sandbox`), Cyan (`x402`), Đỏ (`Kill Switch`) | Giữ nghiêm kỷ luật 4 màu cho dữ liệu tiền/contract; nếu dùng gradient cyan→tím chỉ dùng cho cụm kích hoạt Demo/Agent trung tâm. |

---

## 5. Hai phương án áp dụng cho AgentLeash

### Phương án 1 — Nâng cấp "HUD Glass Skin" trên bố cục hiện tại *(Khuyến nghị an toàn trước 21/11/2026)*
Giữ nguyên kiến trúc 4 panel (`OverviewPanel`, `SpendsPanel`, `SetupPanel`, `RejectionsPanel`) và `DemoControlBar` để không làm xáo trộn luồng demo 7 bước và unit tests hiện tại, chỉ nâng cấp lớp trình bày:
1. **Nền & Card:** Thêm nền radial navy sâu ở `body`/`main`, chuyển card từ phẳng `#0f172a` sang lớp kính tối (`rgba(13, 31, 54, 0.86) → rgba(7, 18, 33, 0.92)`), `backdrop-blur-md`, viền `rgba(122, 222, 255, 0.16)`, `rounded-[18px]`, cạnh trên bắt sáng `inset 0 1px 0 rgba(255,255,255,0.05)`.
2. **Header tối giản kiểu HUD:** Logo `AgentLeash` phát sáng cyan nhẹ + các pill trạng thái bo tròn `rounded-full` (`Fuji Testnet`, `0xPolicy`, `USDC Balance`, `DEMO 120s`), vẫn giữ nút **`KHÓA KHẨN CẤP`** đỏ đặc `#dc2626` nổi bật ở góc phải.
3. **Thêm SVG Radial Ring vào `OverviewPanel`:** Hiển thị trực quan tỷ lệ *Chi được ngay / Hạn mức chu kỳ* bằng vòng cung SVG phát sáng cyan (đỏ khi `paused`), kết hợp 2 thanh meter `Tầng 1 Whitelist` và `Tầng 2 Sandbox` mảnh hơn với đầu thanh phát sáng nhẹ.
4. **Độ động cho `SpendFlowDiagram`:** Thêm hiệu ứng glow và đường nối gradient/pulse dọc theo tuyến `AI Agent → AgentPolicy → API` khi có giao dịch mới.
5. **Nút chạy Demo nổi bật:** Đặt viền gradient 2 lớp (`padding-box` + `border-box` cyan→tím hoặc cyan→emerald) cho nút chạy Demo Agent chính trong `DemoControlBar`.

---

### Phương án 2 — Tái cấu trúc 3 cột "Mission Control" giống hệt SKY *(Đẹp & ấn tượng nhất cho pitch)*
Sắp xếp lại `Dashboard.tsx` thành 3 cột desktop (`xl:grid-cols-[360px_minmax(0,1fr)_500px]`, `gap-5`):

```text
+---------------------------------------------------------------------------------------------------+
| HEADER: [Logo AgentLeash · x402 Guardrail]  [DEMO: 120s] [Fuji] [0xPolicy] [USDC] [Email] [KHÓA KHẨN CẤP] |
+-----------------------------+-----------------------------------+---------------------------------+
| CỘT TRÁI (~360px)           | CỘT GIỮA (1fr - Leash Core)       | CỘT PHẢI (~500px)               |
|                             |                                   |                                 |
| [1. Policy & Identity Card] |                                   | [1. Guardrail Readiness]        |
| - Trạng thái: ACTIVE/PAUSED |      (( Vòng SVG Core ))          | - Radial Ring: Chi được ngay    |
| - Ví Agent + Badge ERC-8004 |    Agent <-> Policy <-> x402      | - Đồng hồ hồi hạn mức (tabular) |
| - Bộ chọn Policy nhanh      |                                   | - Meter Tầng 1 (Whitelist)      |
|                             |  <h1> font-light:                 | - Meter Tầng 2 (Sandbox)        |
| [2. Nhật ký bị từ chối]     |  "Policy đang bảo vệ ví."         |                                 |
| - Danh sách compact         |  (Chi được ngay: X.XXX USDC)      | [2. Panel Đa Tab (Readiness)]   |
| - Kèm nút 1-click:          |                                   | Tabs: [DÒNG TIỀN] [WHITELIST]   |
|   [Chuyển thành API quen]   |  [ Nút tròn 84px phát sáng ]      |       [HẠN MỨC] [ERC-8004]      |
|   hiển thị trực tiếp        |    "Chạy Demo Agent (2p)"         | - Tab mặc định: Sơ đồ           |
|                             |                                   |   SpendFlowDiagram + list chi   |
| [3. 4 Lớp RuleEngine]       |  [Pill viền gradient:             |   kèm nút 1-click Whitelist     |
| - Sandbox Cap | SSRF Check  |   Bật/tắt --bypass-rules (Hack)]  |                                 |
| - Rate Limit  | Whitelist   |                                   | [3. Dải 3 KPI Đáy]              |
|                             |  [Insight Pill ở đáy:             | [Số dư Policy] [Đã chi] [Đã chặn]|
|                             |   Giao dịch gần nhất + Snowscan]  |                                 |
+-----------------------------+-----------------------------------+---------------------------------+
```

---

## 6. Những bẫy của SKY cần tránh khi làm AgentLeash

1. **Không ẩn các nút sống còn của bài thi UniHack:** Theo nguyên tắc sản phẩm và [DESIGN.md](../DESIGN.md#L223):
   - **`KHÓA KHẨN CẤP`**, **nhãn chu kỳ Demo 120s**, và **nút 1-click *Chuyển thành API quen*** phải nhìn thấy ngay trên màn hình chính, không giấu vào modal hay tab phụ.
2. **Không dùng modal chặn lúc mới vào trang:** SKY bật `CREW ROSTER` đè lên màn hình lúc load. Với AgentLeash, giám khảo cần thấy ngay dashboard live từ giây đầu tiên.
3. **Không dùng `overflow-hidden` cứng trên mọi độ cao laptop:** Nhiều laptop thuyết trình có độ phân giải `1366×768` hoặc `1280×800`. Chỉ khóa `100dvh` khi màn hình đủ cao/rộng (hoặc luôn đặt `.al-scroll` bên trong vùng danh sách chi tiêu & nhật ký bị chặn) để không bị cắt mất nút bấm.
4. **Cỡ chữ tối thiểu cho tiếng Việt & máy chiếu:** Không hạ chữ nhãn/nội dung xuống `8.5px–9.5px` như vài badge của SKY; giữ thân chữ `12px–14px`, dùng `Be Vietnam Pro` cho dấu tiếng Việt sắc nét và `tabular-nums` cho mọi số USDC/countdown.
5. **Không tạo route rỗng kiểu `/notebooks` 404:** Giữ toàn bộ thao tác chạy thật trên 1 console duy nhất để đảm bảo độ ổn định trước hạn nộp `21/11/2026`.

---

## 7. Snippet CSS mẫu (tương thích Tailwind v4 trong `web/src/app/globals.css`)

Dùng tham khảo nếu nhóm muốn thử nhanh hiệu ứng bề mặt và nút viền gradient giống SKY trên nền hiện tại:

```css
/* Nền radial sâu kiểu Mission Control */
.al-hud-bg {
  background:
    radial-gradient(ellipse 90% 80% at 50% -10%, rgba(12, 49, 89, 0.72) 0%, transparent 65%),
    radial-gradient(900px 500px at -10% 20%, rgba(99, 102, 241, 0.08), transparent 60%),
    #020617;
}

/* Panel kính mờ + viền ice-cyan mảnh + cạnh trên bắt sáng */
.al-glass-panel {
  border-radius: 18px;
  border: 1px solid rgba(122, 222, 255, 0.16);
  background: linear-gradient(160deg, rgba(13, 31, 54, 0.86), rgba(7, 18, 33, 0.92));
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(8px);
}

/* Nút pill viền gradient 2 lớp giống CTA trung tâm của SKY */
.al-gradient-pill {
  border-radius: 9999px;
  border: 1px solid transparent;
  background:
    linear-gradient(180deg, rgba(10, 22, 44, 0.82), rgba(9, 19, 38, 0.82)) padding-box,
    linear-gradient(90deg, rgba(34, 211, 238, 0.65), rgba(168, 85, 247, 0.6)) border-box;
  box-shadow:
    0 0 22px rgba(34, 211, 238, 0.14),
    0 0 40px rgba(168, 85, 247, 0.1);
}
```
