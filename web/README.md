# Bảng Toán — vẽ toán học bằng Apple Pencil

Web app chạy hoàn toàn trên trình duyệt (không máy chủ, không tài khoản, không tốn phí) để **viết và vẽ toán bằng Apple Pencil trên iPad**, ưu tiên Toán 11: hình học phẳng và không gian, đồ thị hàm số, đường tròn lượng giác.

Dữ liệu lưu ngay trên thiết bị (IndexedDB). Cài lên màn hình chính iPad như một app: Safari → Chia sẻ → **Thêm vào Màn hình chính**. Sau lần mở đầu tiên app chạy được cả khi mất mạng.

## Giao diện (kiểu GoodNotes)

- **Thanh tiêu đề xanh navy** có hàng **tab** cho các bảng đang mở (nút Tài liệu, dấu ×, dấu + để tạo bảng mới) và hàng **công cụ**: Khoanh vùng, Chọn, Bút, Bút dạ quang, Tẩy, Công thức, Hình vẽ nhanh, Hình vẽ sẵn, Đồ thị, Thước kẻ, Thước đo góc; bên phải là Chỉ Pencil, Xuất và menu "…" (nền giấy, thu phóng 100%, xoá bảng).
- **Thanh tuỳ chọn bút nổi** dưới tiêu đề khi dùng bút/dạ quang/đoạn thẳng/mũi tên/compa/hình chữ nhật: Nắn nét, Mượt, Nét đứt, 3 độ dày, 8 màu và nút **+** chọn màu tuỳ ý (màu mới được nhớ trong bảng màu).
- **Nút hoàn tác/làm lại** nổi ở góc trên trái, **khung thu phóng** ở góc dưới trái (bấm % để về 100%, nút vuông để vừa toàn bộ nội dung).
- **Màn hình Tài liệu** (nút nhà): lưới thumbnail các bảng, cột bên trái Tài liệu / Yêu thích, nút **Mới**, ngôi sao yêu thích, menu từng bảng (Đổi tên, Nhân bản, Xoá có xác nhận), chuyển dạng lưới/danh sách. Thumbnail được tạo khi rời một bảng.
- Nền mặc định là **giấy chấm**; đổi ở menu "…". Trên điện thoại thanh tuỳ chọn bút chuyển xuống đáy, các bảng thuộc tính thành bảng trượt từ dưới lên.

## Tính năng

**Vẽ tay**
- Nét bút mực theo áp lực Apple Pencil (Pointer Events, gộp điểm + dự đoán điểm để giảm độ trễ), lưu dạng vector nên phóng to không vỡ.
- **Chống tì tay**: bộ lọc riêng (`canvas/palm.ts`). Khi bút đang chạm, đang lơ lửng (iPad Pro có hover) hoặc vừa nhấc trong vòng 0,5 giây, **mọi điểm chạm bị bỏ qua hoàn toàn**: không vẽ, không kéo, không thu phóng, không kích hoạt hoàn tác. Lòng bàn tay đã đặt sẵn khi bút hạ xuống cũng bị loại bỏ. Thiết bị cảm ứng mở lên ở chế độ **Chỉ Pencil** (ngón tay chỉ kéo và chụm hai ngón để thu phóng; lựa chọn được nhớ); lần đầu chạm ngón có gợi ý cách bật vẽ bằng ngón. Chạm hai/ba ngón hoàn tác/làm lại chỉ tính khi hai ngón cách nhau ≥ 40 px và bút không ở gần. Đầu tẩy của Pencil cũng được nhận.
- Bút, bút dạ quang, tẩy (xoá nguyên nét), 8 màu, độ dày, hoàn tác/làm lại không giới hạn (Ctrl/Cmd+Z, +Shift+Z).
- **Giữ bút để thẳng hoá**: đang vẽ một nét (cong, nguệch ngoạc, thế nào cũng được), *dừng bút ~0,5 giây* → nét thành **đường thẳng từ điểm bắt đầu tới vị trí bút** và tiếp tục bám theo bút cho tới khi nhấc (tự bám 0°/45°/90° khi lệch dưới 3°).
- **Làm mượt nét** (nút *Mượt*: tắt / vừa / mạnh, được nhớ): ổn định nét bằng bộ lọc của perfect-freehand cộng một bước làm trơn điểm; mỗi nét nhớ mức đã dùng nên xuất SVG/PNG vẫn đúng.
- **Nắn nét hình khép kín**: vẽ xong, *giữ bút yên ~0,5 giây trước khi nhấc* → nét được nắn thành đoạn thẳng, đường tròn, elip, tam giác/đa giác hoặc hình chữ nhật/vuông chuẩn (xem trước ngay lúc giữ; di chuyển tiếp để huỷ).
- Nền trắng, ô li, chấm, hoặc hệ trục Oxy.

**Công cụ hình học**
- Thước kẻ (cm và mm): đặt bút sát mép thước để kẻ đường thẳng chuẩn theo mép, kể cả khi xoay thước. Kéo thân thước bằng ngón tay hoặc bút (công cụ Chọn), xoay bằng núm tròn ở đầu thước.
- Thước đo góc 0–180° hai chiều, kéo và xoay như thước kẻ.
- Đoạn thẳng (tự bám 0°/45°/90°), mũi tên, compa (kéo từ tâm ra bán kính), hình chữ nhật; nét liền/nét đứt một chạm.

**Chọn và chỉnh sửa (giống GoodNotes)**
- **Khoanh vùng (lasso)**: vẽ một vòng quanh những gì muốn chọn (nét đủ 50% nằm trong vòng, hình vẽ sẵn nằm phần lớn trong vòng). Bắt đầu vòng ngay trên một nét chưa chọn vẫn khoanh bình thường; chạm vào một nét để chọn riêng nét đó. **Chọn** (mũi tên) chạm để chọn hoặc kéo khung chữ nhật.
- Kéo bên trong vùng chọn để **di chuyển cả cụm**; núm tròn phía trên để xoay (tự bám bội số 15°), ô vuông góc dưới để phóng to/thu nhỏ. Mỗi lần di chuyển/xoay/co giãn là một bước hoàn tác.
- Menu nổi trên vùng chọn: **Cắt, Sao chép, Dán, Nhân đôi, Xoá** (menu ẩn khi đang kéo). Khi không chọn gì mà đã sao chép, hiện nút **Dán**. Phím tắt: Ctrl/Cmd+C, X, V, D, Delete, Ctrl+Z.
- Bảng thuộc tính bên trái: đổi màu (8 màu), độ dày, nét đứt và tham số của hình vẽ sẵn.
- **Cử chỉ**: chạm **hai ngón** = hoàn tác, chạm **ba ngón** = làm lại; một ngón kéo, hai ngón chụm để thu phóng.

**Thư viện 74 hình vẽ sẵn** (chạm để chèn; tìm kiếm không cần gõ dấu; chỉnh tham số bằng thanh trượt):
| Nhóm | Nội dung |
|---|---|
| Hình phẳng (27) | tam giác thường/cân/đều/vuông; đường cao, trung tuyến, phân giác, trung trực, trọng tâm G, trực tâm H, đường tròn nội/ngoại tiếp; hình vuông, chữ nhật, bình hành, thoi, thang, thang cân (tuỳ chọn hai đường chéo + tâm O); đa giác đều n cạnh; đường tròn, elip, hình quạt, góc có số đo, đoạn/tia/đường thẳng, hai đường thẳng song song và cát tuyến |
| Hình không gian (17) | tứ diện, tứ diện đều, chóp tam giác, chóp tứ giác (đáy vuông / bình hành / hình thang, tuỳ chọn đường chéo đáy và SO), hộp chữ nhật, lập phương, hình hộp ABCD.A′B′C′D′, lăng trụ tam giác, trụ, nón, cầu; **giao tuyến**: (ABN)∩(CDM)=MN, (ABN)∩(BCP)=BI, (CDM)∩(BCP)=CJ (Bài 2) và (SAC)∩(SBD)=SO. Nét khuất tự động là nét đứt, xoay góc nhìn bằng thanh trượt. |
| Toạ độ & đồ thị (19) | Oxy, Oxyz; y=ax+b, y=ax²+bx+c, bậc ba, √x, 1/x, \|x\|, aˣ, logₐx, sin, cos, tan, cot; **đồ thị tuỳ ý y=f(x)**; parabol, elip, hypebol (có tiêu điểm/tiệm cận), đường tròn (x−a)²+(y−b)²=R² |
| Lượng giác (3) | đường tròn lượng giác kéo được góc α (sin, cos, tan, cot hiển thị số), bảng giá trị lượng giác, tỉ số lượng giác trong tam giác vuông |
| Khác (8) | vectơ, tổng hai vectơ (hình bình hành), quy tắc ba điểm, trục số (khoảng/đoạn), Venn 2 và 3 tập, sơ đồ cây xác suất, bảng biến thiên |

**Công thức**: hộp *Công thức* có ô **xem trước ngay khi gõ**, bảng ký hiệu bấm là chèn (phân số, căn, mũ, chỉ số, vectơ, chữ Hy Lạp, ≤ ≥ ≠, ∈ ∩ ∪, ⊥ ∥…; bôi đen một đoạn rồi bấm mẫu để bọc đoạn đó), mẫu có tên tiếng Việt và thanh chỉnh cỡ chữ. Cú pháp giống LaTeX (`\frac{a}{b}`, `\sqrt{x}`, `x^2`, `x_1`, `\vec{AB}`, `\alpha`, `\pi`, `\le`, `\cap`, `\perp`, `\parallel`…). Ô *Đồ thị* có xem trước đường cong và các mẫu (Parabol, Sin, Phân thức…), nhận biểu thức như `2x+1`, `x^2-2x-3`, `sin(x)/x`, `1/(x-1)`, `log2(x)`; sai cú pháp sẽ báo lỗi rõ ràng (bộ phân tích tự viết, không dùng `eval`).

**Nhiều bảng + xuất file**: tạo/đổi tên/xoá bảng; xuất **PNG**, **SVG**, **PDF** (bảng hiện tại hoặc tất cả các bảng), chia sẻ qua bảng chia sẻ của iPad.

## Chạy và kiểm thử

```bash
cd web
npm ci
npm run dev        # http://localhost:5173 (thêm --host để mở từ iPad trong cùng Wi-Fi)
npm run build      # kiểm tra kiểu + build vào web/dist
npm test           # unit test (Vitest)
npm run e2e        # e2e Chromium: mô phỏng bút/cảm ứng, bố cục 6 kích thước, bản production + offline
```

`npm run e2e` tự build bản phát hành (kèm móc kiểm thử) rồi chạy các bộ kiểm thử trên đó, và cần Chromium: đặt `CHROME=/đường/dẫn/chrome` hoặc dùng `npx playwright-core install chromium`.

## Triển khai miễn phí (GitHub Pages)

1. Đẩy code lên nhánh `main`.
2. Trên GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Workflow `.github/workflows/web.yml` tự kiểm tra kiểu, chạy unit test, build và đăng lên `https://<tên-người-dùng>.github.io/<tên-repo>/`.

Có thể dùng bất kỳ hosting tĩnh nào khác: chỉ cần phục vụ thư mục `web/dist` (đường dẫn tương đối nên chạy được trong thư mục con).

## Cấu trúc mã

```
web/src/
  canvas/    Board (sự kiện bút/cảm ứng), store (Zustand, hoàn tác), render, objects (chọn/biến đổi), snap (nhận dạng nét), aids (thước)
  math/      expr (bộ phân tích biểu thức), mathtext (dàn trang công thức), solid3d (chiếu 3D + nét khuất)
  shapes/    plane, solids, coord, trig, misc + registry (mỗi hình là hàm thuần tạo ra danh sách primitive)
  ui/        thanh công cụ, thư viện, inspector, hộp thoại, quản lý bảng, xuất file
  storage/   IndexedDB (nhiều bảng), xuất PNG/SVG/PDF
web/tests/   unit (Vitest) và e2e (Playwright-core)
```

## Đã kiểm chứng gì

- **Unit (90)**: bộ phân tích biểu thức (thứ tự phép tính, ngầm định nhân, từ chối đầu vào nguy hiểm); dàn công thức không bao giờ ném lỗi; nhận dạng nét (đường thẳng, tròn, elip, chữ nhật, tam giác, nét nguệch ngoạc); **nét khuất khớp một bộ kiểm tra che khuất độc lập trên hơn 1.000 góc nhìn**; hình học từng hình (tâm nội/ngoại tiếp, trực tâm, đường phân giác, các tứ giác, đa giác đều, tiếp tuyến hình nón, giao tuyến Bài 2); mọi hình hợp lệ ở tham số nhỏ nhất/mặc định/lớn nhất; cấu trúc PDF (bảng xref) và SVG; hoàn tác/làm lại, gộp bước hoàn tác, chuyển bảng, nạp dữ liệu cũ, tạo id khi không có `crypto.randomUUID`.
- **E2E (317 kiểm tra)**: bút với áp lực thay đổi, chống tì tay, chụm hai ngón, chọn/khoanh vùng/di chuyển/xoay/co giãn, cắt-sao chép-dán, chạm 2-3 ngón, thước bám mép (cả khi xoay), nắn nét, hộp thoại đồ thị/công thức, nhiều bảng, tab, thư viện tài liệu (thumbnail, yêu thích, đổi tên, nhân bản, xoá) và khôi phục sau tải lại, tải về PNG/SVG/PDF thật, bố cục iPad dọc/ngang, iPhone (lớn, nhỏ, ngang), laptop, bản production chạy offline; mở qua `http://` (không có `crypto.randomUUID`) và khi trình duyệt chặn lưu trữ vẫn không bị trắng trang.

## Tốc độ khởi động

- Bản phát hành dùng **Preact** (cùng API với React, nhẹ hơn nhiều): JS còn 153 KB (nén ~56 KB), so với 271 KB (~92 KB) khi dùng React. Khi phát triển và kiểm tra kiểu vẫn dùng React thật (`REACT_BUNDLE=1 npm run build` để build bằng React).
- Khung chờ hiện ngay từ HTML, giao diện dựng ngay không chờ đọc IndexedDB; bảng đã lưu được nạp nền rồi vẽ khi sẵn sàng (nét vẽ ngay lúc đó không bị mất).
- Đo trên Chromium giả lập CPU chậm gấp 4 (trung vị 7 lần): giao diện sẵn sàng sau ~180 ms (React: ~250 ms), khung chờ hiện sau ~60 ms.
- `scripts/build-artifact.py` gộp bản build thành một file HTML duy nhất (dùng cho Artifact của Claude).

## Giới hạn / chưa xác minh

- **Chưa thử trên iPad và Apple Pencil thật** (môi trường phát triển không có thiết bị): độ trễ, cảm giác áp lực, tì tay thực tế, "Thêm vào Màn hình chính" cần bạn thử tay. Kiểm thử dùng bút/cảm ứng giả lập của Chromium.
- Hiệu năng đo trên Chromium không GPU: 1.000 nét ≈ 26 ms/khung khi kéo-thu phóng, 5.000 nét ≈ 62 ms (phần lớn là tô phần mềm; mã JS chỉ ~3 ms). Trên GPU của iPad dự kiến tốt hơn nhiều nhưng **chưa đo**.
- Đơn vị "cm" trên thước tính theo lưới của bảng, không phải kích thước vật lý của màn hình.
- Xuất SVG: công thức được xuất dạng chữ thường (ví dụ `√3/2`), không giữ dàn trang phân số; PNG và PDF (là ảnh) thì giữ nguyên.
- Dữ liệu chỉ nằm trên thiết bị; xoá dữ liệu trình duyệt sẽ mất bảng — hãy xuất PDF/PNG để lưu trữ.
- Nắn nét chỉ nhận các hình đơn (một nét khép kín hoặc một đoạn thẳng); đa giác trên 6 đỉnh giữ nguyên nét tay.
