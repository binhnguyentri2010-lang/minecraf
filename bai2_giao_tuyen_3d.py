# -*- coding: utf-8 -*-
"""
BÀI 2 (Dạng 1 - Tìm giao tuyến của hai mặt phẳng)
Cho tứ diện ABCD. Gọi M, N, P lần lượt nằm trên ba cạnh AB, CD, AD.
Tìm giao tuyến của các cặp mặt phẳng:

    a) (ABN) và (CDM)   ->  giao tuyến MN
    b) (ABN) và (BCP)   ->  giao tuyến BI,  I = AN  ∩ CP   (trong mp (ACD))
    c) (CDM) và (BCP)   ->  giao tuyến CJ,  J = DM  ∩ BP   (trong mp (ABD))

Chạy:  python3 bai2_giao_tuyen_3d.py
Xuất:  bai2_cau_a.png, bai2_cau_b.png, bai2_cau_c.png, bai2_tong_hop.png
"""

import numpy as np
import matplotlib

matplotlib.use("Agg")  # xuất file ảnh, không cần màn hình
import matplotlib.pyplot as plt
from matplotlib.patches import Polygon

# ----------------------------------------------------------------------------
# 1. TOẠ ĐỘ 3D CỦA HÌNH  (đổi số ở đây là hình đổi theo)
# ----------------------------------------------------------------------------
A = np.array([-0.2, 0.3, 3.4])   # đỉnh
B = np.array([-2.4, -0.9, 0.0])
C = np.array([2.7, -1.5, 0.0])
D = np.array([1.0, 2.5, 0.0])

T_M = 0.45   # M thuộc AB :  M = A + T_M*(B-A)
T_N = 0.45   # N thuộc CD :  N = C + T_N*(D-C)
T_P = 0.55   # P thuộc AD :  P = A + T_P*(D-A)

AZIM, ELEV = -62.0, 16.0   # góc nhìn (độ)

COL_EDGE = "#1f2937"       # cạnh tứ diện
COL_P1 = "#2563eb"         # mặt phẳng thứ nhất
COL_P2 = "#ea8c00"         # mặt phẳng thứ hai
COL_CUT = "#dc2626"        # giao tuyến
COL_AUX = "#0f766e"        # đường phụ


def lerp(U, V, t):
    return U + t * (V - U)


M = lerp(A, B, T_M)
N = lerp(C, D, T_N)
P = lerp(A, D, T_P)

PTS = {"A": A, "B": B, "C": C, "D": D, "M": M, "N": N, "P": P}


# ----------------------------------------------------------------------------
# 2. GIAO ĐIỂM CỦA HAI ĐƯỜNG THẲNG ĐỒNG PHẲNG (bình phương tối thiểu)
# ----------------------------------------------------------------------------
def giao_diem(P1, Q1, P2, Q2):
    """Giao điểm của đường thẳng P1Q1 và P2Q2 (hai đường cùng nằm một mặt phẳng)."""
    d1, d2 = Q1 - P1, Q2 - P2
    t, _ = np.linalg.lstsq(np.column_stack([d1, -d2]), P2 - P1, rcond=None)[0]
    return P1 + t * d1


I = giao_diem(A, N, C, P)   # AN ∩ CP  nằm trong mp (ACD)
J = giao_diem(D, M, B, P)   # DM ∩ BP  nằm trong mp (ABD)


# ----------------------------------------------------------------------------
# 3. PHÉP CHIẾU SONG SONG 3D -> 2D  +  XÁC ĐỊNH CẠNH KHUẤT
# ----------------------------------------------------------------------------
a, e = np.radians(AZIM), np.radians(ELEV)
VIEW = np.array([np.cos(e) * np.cos(a), np.cos(e) * np.sin(a), np.sin(e)])  # hướng nhìn
RIGHT = np.array([-np.sin(a), np.cos(a), 0.0])
UP = np.cross(VIEW, RIGHT)


def proj(X):
    """Chiếu điểm (hoặc mảng điểm) 3D xuống mặt phẳng hình vẽ."""
    X = np.asarray(X, dtype=float)
    return np.array([X @ RIGHT, X @ UP]) if X.ndim == 1 else np.column_stack([X @ RIGHT, X @ UP])


FACES = [("A", "B", "C", "D"), ("A", "B", "D", "C"),
         ("A", "C", "D", "B"), ("B", "C", "D", "A")]


def canh_khuat():
    """Cạnh bị khuất <=> cả hai mặt chứa nó đều quay lưng về phía người nhìn."""
    huong = {}
    for p, q, r, s in FACES:
        n = np.cross(PTS[q] - PTS[p], PTS[r] - PTS[p])
        if n @ (PTS[s] - PTS[p]) > 0:      # ép pháp tuyến hướng ra ngoài khối
            n = -n
        for canh in ((p, q), (q, r), (p, r)):
            huong.setdefault(frozenset(canh), []).append(n @ VIEW > 0)
    return {k for k, v in huong.items() if not any(v)}


KHUAT = canh_khuat()


# ----------------------------------------------------------------------------
# 4. CÁC HÀM VẼ
# ----------------------------------------------------------------------------
def doan(ax, U, V, **kw):
    (x1, y1), (x2, y2) = proj(U), proj(V)
    ax.plot([x1, x2], [y1, y2], **kw)


def khung_tu_dien(ax):
    """Sáu cạnh của tứ diện: nét liền nếu thấy, nét đứt nếu khuất."""
    for u, v in [("A", "B"), ("A", "C"), ("A", "D"),
                 ("B", "C"), ("B", "D"), ("C", "D")]:
        an = frozenset((u, v)) in KHUAT
        doan(ax, PTS[u], PTS[v], color=COL_EDGE, lw=1.6, zorder=3,
             ls=(0, (6, 4)) if an else "-", alpha=0.75 if an else 1.0)


def to_mat(ax, dinh, mau, nhan, vitri_nhan):
    """Tô một mặt phẳng (đa giác) và ghi tên mặt phẳng."""
    ax.add_patch(Polygon(proj(np.array(dinh)), closed=True, facecolor=mau,
                         alpha=0.20, edgecolor=mau, lw=1.3, zorder=1))
    x, y = proj(np.asarray(vitri_nhan))
    ax.text(x, y, nhan, color=mau, fontsize=12, fontweight="bold",
            ha="center", va="center", zorder=6,
            bbox=dict(boxstyle="round,pad=0.18", fc="white", ec="none", alpha=0.75))


LECH = {"A": (0, 14), "B": (-14, -8), "C": (14, -8), "D": (16, 6),
        "M": (-15, 2), "N": (16, 1), "P": (15, 0), "I": (-6, -14), "J": (-4, 14)}


def ten_diem(ax, ten, X, mau="#111827"):
    x, y = proj(X)
    ax.plot([x], [y], "o", ms=5, color=mau, zorder=7)
    dx, dy = LECH.get(ten, (12, 8))
    ax.annotate(ten, (x, y), textcoords="offset points", xytext=(dx, dy),
                fontsize=13, fontweight="bold", color=mau, zorder=7)


def keo_dai(ax, U, V, he_so=1.35, **kw):
    """Vẽ đường thẳng UV kéo dài qua khỏi V cho dễ nhìn."""
    doan(ax, U, U + he_so * (V - U), **kw)


# ----------------------------------------------------------------------------
# 5. NỘI DUNG TỪNG CÂU
# ----------------------------------------------------------------------------
def cau_a(ax):
    """(ABN) ∩ (CDM) = MN."""
    to_mat(ax, [A, B, N], COL_P1, "(ABN)", (A + B + N) / 3)
    to_mat(ax, [C, D, M], COL_P2, "(CDM)", 0.40 * C + 0.42 * D + 0.18 * M)
    khung_tu_dien(ax)
    doan(ax, M, N, color=COL_CUT, lw=3.0, zorder=5)
    for t in "ABCD":
        ten_diem(ax, t, PTS[t])
    for t in ("M", "N"):
        ten_diem(ax, t, PTS[t], COL_CUT)
    return ("a) (ABN) và (CDM)",
            "M ∈ AB ⊂ (ABN) và M ∈ (CDM);  N ∈ CD ⊂ (CDM) và N ∈ (ABN)\n"
            "⇒ (ABN) ∩ (CDM) = MN")


def cau_b(ax):
    """(ABN) ∩ (BCP) = BI, với I = AN ∩ CP."""
    to_mat(ax, [A, B, N], COL_P1, "(ABN)", 0.42 * A + 0.30 * B + 0.28 * N)
    to_mat(ax, [B, C, P], COL_P2, "(BCP)", 0.42 * B + 0.44 * C + 0.14 * P)
    khung_tu_dien(ax)
    doan(ax, A, N, color=COL_AUX, lw=1.3, ls=(0, (5, 3)), zorder=4)
    doan(ax, C, P, color=COL_AUX, lw=1.3, ls=(0, (5, 3)), zorder=4)
    keo_dai(ax, B, I, 1.12, color=COL_CUT, lw=3.0, zorder=5)
    for t in "ABCD":
        ten_diem(ax, t, PTS[t])
    ten_diem(ax, "N", N)
    ten_diem(ax, "P", P)
    ten_diem(ax, "I", I, COL_CUT)
    ten_diem(ax, "B", B, COL_CUT)
    return ("b) (ABN) và (BCP)",
            "B là điểm chung thứ nhất.  Trong mp (ACD): I = AN ∩ CP\n"
            "I ∈ AN ⊂ (ABN), I ∈ CP ⊂ (BCP) ⇒ (ABN) ∩ (BCP) = BI")


def cau_c(ax):
    """(CDM) ∩ (BCP) = CJ, với J = DM ∩ BP."""
    to_mat(ax, [C, D, M], COL_P1, "(CDM)", 0.18 * C + 0.46 * D + 0.36 * M)
    to_mat(ax, [B, C, P], COL_P2, "(BCP)", 0.46 * B + 0.34 * C + 0.20 * P)
    khung_tu_dien(ax)
    doan(ax, D, M, color=COL_AUX, lw=1.3, ls=(0, (5, 3)), zorder=4)
    doan(ax, B, P, color=COL_AUX, lw=1.3, ls=(0, (5, 3)), zorder=4)
    keo_dai(ax, C, J, 1.22, color=COL_CUT, lw=3.0, zorder=5)
    for t in "ABCD":
        ten_diem(ax, t, PTS[t])
    ten_diem(ax, "M", M)
    ten_diem(ax, "P", P)
    ten_diem(ax, "J", J, COL_CUT)
    ten_diem(ax, "C", C, COL_CUT)
    return ("c) (CDM) và (BCP)",
            "C là điểm chung thứ nhất.  Trong mp (ABD): J = DM ∩ BP\n"
            "J ∈ DM ⊂ (CDM), J ∈ BP ⊂ (BCP) ⇒ (CDM) ∩ (BCP) = CJ")


CAC_CAU = [cau_a, cau_b, cau_c]


def khung_hinh(ax, ve):
    ax.set_aspect("equal")
    ax.axis("off")
    tieu_de, giai_thich = ve(ax)
    ax.set_title(tieu_de, fontsize=14, fontweight="bold", pad=10)
    ax.text(0.5, -0.02, giai_thich, transform=ax.transAxes, ha="center", va="top",
            fontsize=10.5, color="#374151", linespacing=1.5)
    xy = proj(np.array(list(PTS.values()) + [I, J]))
    ax.set_xlim(xy[:, 0].min() - 0.9, xy[:, 0].max() + 0.9)
    ax.set_ylim(xy[:, 1].min() - 1.5, xy[:, 1].max() + 0.8)


# ----------------------------------------------------------------------------
# 6. XUẤT ẢNH
# ----------------------------------------------------------------------------
def main():
    for ten, ve in zip("abc", CAC_CAU):
        fig, ax = plt.subplots(figsize=(6.2, 6.4))
        khung_hinh(ax, ve)
        fig.savefig(f"bai2_cau_{ten}.png", dpi=200, bbox_inches="tight",
                    facecolor="white")
        plt.close(fig)
        print(f"Đã vẽ  bai2_cau_{ten}.png")

    fig, axes = plt.subplots(1, 3, figsize=(18, 6.6))
    for ax, ve in zip(axes, CAC_CAU):
        khung_hinh(ax, ve)
    fig.suptitle("Bài 2 — Tứ diện ABCD, M ∈ AB, N ∈ CD, P ∈ AD",
                 fontsize=15, fontweight="bold")
    fig.savefig("bai2_tong_hop.png", dpi=170, bbox_inches="tight", facecolor="white")
    plt.close(fig)
    print("Đã vẽ  bai2_tong_hop.png")


if __name__ == "__main__":
    main()
