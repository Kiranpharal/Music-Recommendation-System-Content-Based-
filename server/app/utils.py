"""
utils.py  ▸ Custom NumPy helpers for large-scale music-recommender pipeline
---------------------------------------------------------------------------
• MyMinMaxScaler      - feature-wise 0-1 scaling (float32 for memory speed)
• cosine_sim          - fast cosine similarity between 1 vector & N vectors
• kmeans_mini_batch   - Mini-Batch K-Means with k-means++ init (batch-wise, scales to 1.2 M rows)
• silhouette_sample   - Approximate silhouette score using batch-based subsampling
"""

from __future__ import annotations
import numpy as np
from numpy.random import default_rng


# 1. Min–Max scaler (vectorized)
class MyMinMaxScaler:
    """
    ( NumPy and float32-optimized).

    Methods
    -------
    • fit(X)              - compute feature-wise min & range
    • transform(X)        - scale new data
    • fit_transform(X)    - convenience wrapper

    Attributes (after .fit)
    -----------------------
    • min_      ndarray (d,)
    • range_    ndarray (d,)  - max-min (ε-protected)
    """

    def fit(self, X: np.ndarray) -> "MyMinMaxScaler":
        X = np.asarray(X, dtype=np.float32)
        self.min_ = X.min(axis=0)
        max_ = X.max(axis=0)
        self.range_ = np.where(max_ - self.min_ == 0.0, 1.0, max_ - self.min_)
        return self

    def transform(self, X: np.ndarray) -> np.ndarray:
        X = np.asarray(X, dtype=np.float32)
        return (X - self.min_) / self.range_

    def fit_transform(self, X: np.ndarray) -> np.ndarray:
        return self.fit(X).transform(X)


# 2. Cosine similarity (single-vector vs matrix)
def cosine_sim(vec: np.ndarray,
               mat: np.ndarray,
               eps: float = 1e-8) -> np.ndarray:
    """
    Compute cosine similarity between one vector (d,) and a matrix (n,d).
    Returns an (n,) array of similarities in [-1, 1].
    """
    vec = vec.astype(np.float32)
    mat = mat.astype(np.float32)
    v_norm = np.linalg.norm(vec) + eps
    m_norm = np.linalg.norm(mat, axis=1) + eps
    dots = mat @ vec
    return dots / (m_norm * v_norm)


# 3. Mini-Batch K-Means (NumPy-only, batch-wise)
def kmeans_mini_batch(X: np.ndarray,
                      k: int = 7,
                      batch_size: int = 50_000,
                      max_iter: int = 100,
                      tol: float = 1e-4,
                      seed: int = 42) -> tuple[np.ndarray, np.ndarray]:

    rng = default_rng(seed)
    X = np.asarray(X, dtype=np.float32)
    n, d = X.shape

    # k-means++ initialization
    centroids = np.empty((k, d), dtype=np.float32)
    centroids[0] = X[rng.integers(n)]
    closest_sq = np.full(n, np.inf, dtype=np.float32)

    for c in range(1, k):
        dist_sq = np.sum((X - centroids[c - 1]) ** 2, axis=1)
        closest_sq = np.minimum(closest_sq, dist_sq)
        probs = closest_sq / closest_sq.sum()
        centroids[c] = X[rng.choice(n, p=probs)]

    counts = np.zeros(k, dtype=np.int64)
    prev_inertia = np.inf

    # batch-wise label assignment
    def assign_labels_batch(X_full, centroids, batch_sz=100_000):
        labels = np.empty(X_full.shape[0], dtype=np.int32)
        for i in range(0, X_full.shape[0], batch_sz):
            end = min(i + batch_sz, X_full.shape[0])
            batch = X_full[i:end]
            dist = np.linalg.norm(batch[:, None] - centroids[None], axis=2)
            labels[i:end] = dist.argmin(axis=1)
        return labels

    for it in range(max_iter):
        batch_idx = rng.choice(n, size=min(batch_size, n), replace=False)
        B = X[batch_idx]

        # assignment (batch only)
        dist = np.linalg.norm(B[:, None] - centroids[None], axis=2)
        lbl = dist.argmin(axis=1)

        # centroid update
        for j in range(k):
            mask = lbl == j
            n_j = mask.sum()
            if n_j == 0:
                continue
            counts[j] += n_j
            eta = 1.0 / counts[j]
            centroids[j] += eta * (B[mask].mean(axis=0) - centroids[j])

        # global convergence check every 10 iterations
        if it % 10 == 0 or it == max_iter - 1:
            labels_full = assign_labels_batch(X, centroids, batch_size)
            inertia = np.sum((np.linalg.norm(X - centroids[labels_full], axis=1)) ** 2)
            if abs(prev_inertia - inertia) < tol * prev_inertia:
                break
            prev_inertia = inertia

    # final assignment
    labels = assign_labels_batch(X, centroids, batch_size)
    return labels, centroids


# 4. Sample-based silhouette score (batch-wise)
def silhouette_sample(X: np.ndarray,
                      labels: np.ndarray,
                      sample_size: int = 20_000,
                      seed: int = 42) -> float:
    """
    Approximate mean silhouette coefficient by subsampling.

    • X        : (n, d) data matrix
    • labels   : (n,) cluster labels from k-means
    • sample_size : number of points to subsample (≤ n)

    Returns
    -------
    float   - estimated silhouette in [-1, 1]
    """
    rng = default_rng(seed)
    n = X.shape[0]
    if n <= sample_size:
        idx = np.arange(n)
    else:
        idx = rng.choice(n, size=sample_size, replace=False)

    Xs = X[idx].astype(np.float32)
    ls = labels[idx]
    uniq = np.unique(ls)

    # pairwise distance matrix (m, m) in batches
    m = len(idx)
    batch_sz = 5000  # memory safe
    a = np.zeros(m, dtype=np.float32)
    b = np.full(m, np.inf, dtype=np.float32)

    for i_start in range(0, m, batch_sz):
        i_end = min(i_start + batch_sz, m)
        Xi = Xs[i_start:i_end]
        li = ls[i_start:i_end]

        # intra-cluster distances
        for c in uniq:
            mask_i = li == c
            mask_j = ls == c
            if mask_j.sum() > 1:
                D = np.linalg.norm(Xi[mask_i][:, None] - Xs[mask_j][None, :], axis=2)
                a[i_start:i_end][mask_i] = D.sum(axis=1) / (mask_j.sum() - 1)
            else:
                a[i_start:i_end][mask_i] = 0.0

        # nearest-other-cluster distances
        for c in uniq:
            mask_i = li == c
            for c2 in uniq:
                if c2 == c:
                    continue
                mask_j = ls == c2
                if mask_j.sum() > 0:
                    D = np.linalg.norm(Xi[mask_i][:, None] - Xs[mask_j][None, :], axis=2)
                    b[i_start:i_end][mask_i] = np.minimum(b[i_start:i_end][mask_i], D.mean(axis=1))

    s = (b - a) / np.maximum(a, b)
    return float(np.nanmean(s))
