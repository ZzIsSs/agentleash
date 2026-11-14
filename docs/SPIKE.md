# Báo cáo Spike Giai đoạn 0: Kiểm chứng x402 qua ERC-1271 trên Avalanche Fuji

> **Thời gian thực hiện:** 13/11/2026  
> **Người thực hiện:** Nguyên (kỹ thuật AgentLeash)  
> **Mục tiêu:** Chứng minh trọn vòng giao dịch x402 với người trả (`from`) là smart contract (`SpikePolicy`) thông qua chuẩn chữ ký ERC-1271 và EIP-3009 (`transferWithAuthorization`) trên Avalanche Fuji C-Chain (Chain ID `43113`).

---

## 1. Kết luận chính (TL;DR)

1. **ERC-1271 trên x402 khả thi 100%:** Smart contract policy giữ USDC hoàn toàn có thể đứng làm `payer` (`from`) trong giao thức x402. Khi client trả chữ ký `0x`, USDC trên Fuji (`FiatTokenV2_2`) gọi `isValidSignature` vào contract và thực hiện `transferWithAuthorization`.
2. **Kết quả kiểm thử 3 Facilitator:**
   - **Facilitator tự host (Starter kit BTC):** **THÀNH CÔNG (200 OK)**. Giao dịch on-chain thành công ngay lần thử đầu tiên.
   - **PayAI Facilitator (`https://facilitator.payai.network`):** **THÀNH CÔNG (200 OK)**. Hỗ trợ ERC-1271 đầy đủ, batch settlement qua Multicall3.
   - **Ultravioleta DAO (`https://facilitator.ultravioletadao.xyz`):** **TỪ CHỐI (402 Payment Required)** với lỗi `invalid_signature` do middleware kiểm tra chữ ký ECDSA truyền thống.
3. **Quyết định cho dự án:**
   - **Ưu tiên số 1 (chính thức khi demo):** **Facilitator tự host** (`FACILITATOR_URL=http://localhost:4022`) để kiểm soát toàn bộ hạ tầng, đảm bảo demo không bị ảnh hưởng bởi mạng ngoài hay cạn gas của bên thứ ba.
   - **Dự phòng công khai:** **PayAI Network** (`https://facilitator.payai.network`).
   - Loại bỏ Ultravioleta DAO khỏi danh sách facilitator tương thích.

---

## 2. Thông tin triển khai On-Chain (Avalanche Fuji)

- **Mạng:** Avalanche Fuji Testnet (Chain ID `43113`)
- **USDC Contract:** `0x5425890298aed601595a70AB815c96711a31Bc65` (Circle FiatTokenV2_2)
- **SpikePolicy Contract:** [`0x38706AFC0f92b6908389ebF377aab688a2BDe951`](https://testnet.snowtrace.io/address/0x38706AFC0f92b6908389ebF377aab688a2BDe951)
  - **Tx Deploy:** [`0x8d183a4b9be9472007209b152469bf0351d95e8023988a69c8bfa0246ded5e40`](https://testnet.snowtrace.io/tx/0x8d183a4b9be9472007209b152469bf0351d95e8023988a69c8bfa0246ded5e40)
  - **Tx nạp 0.01 USDC:** [`0x32506163e996d6e36eb2a3a783996116af90e9ae741489725788bf69b629e9cd`](https://testnet.snowtrace.io/tx/0x32506163e996d6e36eb2a3a783996116af90e9ae741489725788bf69b629e9cd)
  - **Owner (Deployer):** `0xd30CcDd472372f92f9DeDFaafDeD9615136b75CB`
  - **Agent:** `0x0F8de357042E53bF0E647066F0Bb1a446133ef9D`
- **Địa chỉ nhận tiền bên bán (`WEATHER_PAY_TO`):** `0x9D014376C3296db41770015AF074CF4D14c075E1`
- **Địa chỉ ví Facilitator tự host:** `0xa58c2Dcc274Ee68744Cb81e7a8E02b487d277fd3`

---

## 3. Chi tiết kết quả kiểm thử từng Facilitator

### 3.1. Facilitator tự host (chạy từ starter kit BTC)

- **URL:** `http://localhost:4022`
- **Kết quả:** **THÀNH CÔNG (200 OK)**
- **Giao dịch settlement on-chain:**
  - **Tx Hash:** [`0x52e1d691bd6e59bd29f048ddb797921c5737fafd51273114555dbd3f75ca74ba`](https://testnet.snowtrace.io/tx/0x52e1d691bd6e59bd29f048ddb797921c5737fafd51273114555dbd3f75ca74ba)
  - **From (người nộp gas):** `0xa58c2Dcc274Ee68744Cb81e7a8E02b487d277fd3` (Facilitator)
  - **To (tương tác hợp đồng):** `0x5425890298aed601595a70AB815c96711a31Bc65` (USDC)
  - **Hàm gọi:** `transferWithAuthorization(address,address,uint256,uint256,uint256,bytes32,bytes)` (selector `0xcf092995`)
  - **Event Logs xác nhận:**
    1. `AuthorizationUsed(authorizer: 0x38706afc0f92b6908389ebf377aab688a2bde951, nonce: ...)`
    2. `Transfer(from: 0x38706afc0f92b6908389ebf377aab688a2bde951, to: 0x9d014376c3296db41770015af074cf4d14c075e1, value: 1000)` (0.001 USDC)
  - **Phản hồi API:**
    ```json
    {
      "city": "Da Lat",
      "temperatureC": 19,
      "condition": "Cool & Misty",
      "humidity": 82,
      "timestamp": "2026-11-12T17:15:07.736Z"
    }
    ```

### 3.2. PayAI Network Facilitator

- **URL:** `https://facilitator.payai.network`
- **Kết quả:** **THÀNH CÔNG (200 OK)**
- **Giao dịch settlement on-chain:**
  - **Tx Hash:** [`0xfb25dd4e92f36dbc8a74ba8f31616dd300af1576adc9cee78b44dd10786d6bf3`](https://testnet.snowtrace.io/tx/0xfb25dd4e92f36dbc8a74ba8f31616dd300af1576adc9cee78b44dd10786d6bf3)
  - **From (người nộp gas):** `0xc6699d2aadA6c36Dfea5C248DD70f9CB0235cB63` (PayAI Relayer)
  - **To (qua Multicall3):** `0xcA11bde05977b3631167028862bE2a173976CA11`
  - **Target thực thi:** `0x5425890298aed601595a70AB815c96711a31Bc65` (USDC)
  - **Event Logs xác nhận:** Chuyển 0.001 USDC từ `SpikePolicy` sang `WEATHER_PAY_TO`. Số dư SpikePolicy giảm tiếp xuống còn 0.008 USDC.

### 3.3. Ultravioleta DAO Facilitator

- **URL:** `https://facilitator.ultravioletadao.xyz`
- **Kết quả:** **TỪ CHỐI (402 Payment Required)**
- **Thông báo lỗi từ Facilitator:**
  ```json
  {
    "isValid": false,
    "invalidReason": "invalid_signature",
    "payer": "0x38706AFC0f92b6908389ebF377aab688a2BDe951",
    "status": "rejected"
  }
  ```
- **Phân tích nguyên nhân:** Ultravioleta DAO sử dụng cơ chế kiểm tra chữ ký nghiêm ngặt kiểu ECDSA EOA (yêu cầu độ dài 65 bytes phục hồi được ra địa chỉ `from`). Khi nhận địa chỉ `from` là smart contract và chữ ký ERC-1271, facilitator này không thực hiện bước gọi `isValidSignature` off-chain như PayAI và Facilitator của thư viện `@x402/evm`.

---

## 4. Cơ chế hoạt động của Custom `policySigner`

Trong `agentleash/agent/src/policySigner.ts`:
1. **Khởi tạo:** `address` của signer được đặt là địa chỉ của contract `SpikePolicy` (thay vì ví EOA của agent). Nhờ đó, x402 nhận diện `payer` chính là contract.
2. **Ký thông điệp (`signTypedData`):**
   - Thay vì ký mã hoá cục bộ bằng private key của contract (vốn không tồn tại), hàm nhận các trường EIP-712 và tính ra digest `TransferWithAuthorization`.
   - Ví agent (`AGENT_PRIVATE_KEY`) gửi giao dịch gọi `SpikePolicy.approve(digest)` trên Avalanche Fuji và đợi receipt thành công.
   - Trả về chữ ký rỗng `0x`.
3. **Xác thực và chuyển tiền:**
   - Facilitator gọi `transferWithAuthorization(from = SpikePolicy, ..., signature = 0x)`.
   - USDC trên Fuji nhận thấy `SpikePolicy` là contract, gọi ngược lại `SpikePolicy.isValidSignature(digest, 0x)`.
   - `SpikePolicy` kiểm tra mapping `approved[digest] == true`, trả về magic value `0x1626ba7e`.
   - USDC chuyển 0.001 USDC sang `WEATHER_PAY_TO`.

---

## 5. Đề xuất cập nhật đặc tả kiến trúc

- **Chốt mục "Chưa chốt #1":** Đã giải quyết triệt để. Hệ thống x402 hoàn toàn tương thích với mô hình policy contract của AgentLeash khi sử dụng **Facilitator tự host** hoặc **PayAI**.
- Sẵn sàng 100% để bước vào **Giai đoạn 1 (Xây dựng `AgentPolicy.sol` hoàn chỉnh)**.
