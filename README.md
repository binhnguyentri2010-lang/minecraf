# Hình học 11 — Bài 2 (Dạng 1: Tìm giao tuyến của hai mặt phẳng)

Cho tứ diện `ABCD`. Gọi `M`, `N`, `P` lần lượt nằm trên ba cạnh `AB`, `CD`, `AD`.

| Câu | Cặp mặt phẳng | Giao tuyến |
|-----|---------------|------------|
| a   | `(ABN)` và `(CDM)` | `MN` |
| b   | `(ABN)` và `(BCP)` | `BI`, với `I = AN ∩ CP` (trong mp `(ACD)`) |
| c   | `(CDM)` và `(BCP)` | `CJ`, với `J = DM ∩ BP` (trong mp `(ABD)`) |

## Chạy

```bash
pip install matplotlib numpy
python3 bai2_giao_tuyen_3d.py
```

Xuất ra `bai2_cau_a.png`, `bai2_cau_b.png`, `bai2_cau_c.png` (mỗi câu một hình)
và `bai2_tong_hop.png` (ghép cả ba).

## Chỉnh hình

Mọi thông số nằm ở đầu file `bai2_giao_tuyen_3d.py`:

- `A`, `B`, `C`, `D`: toạ độ 3D bốn đỉnh tứ diện.
- `T_M`, `T_N`, `T_P`: vị trí của `M`, `N`, `P` trên cạnh (0 → 1). Ví dụ `0.5` là trung điểm.
- `AZIM`, `ELEV`: góc nhìn. Đổi hai số này để xoay hình.

Cạnh khuất được tự động vẽ nét đứt (thuật toán loại mặt khuất của khối lồi),
nên đổi góc nhìn thì nét liền/nét đứt vẫn đúng.
