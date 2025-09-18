# server/app/tests/test_metrics.py
import numpy as np

def precision_at_k(recommended, relevant, k=10):
    rec_k = recommended[:k]
    return len(set(rec_k) & set(relevant)) / k

def recall_at_k(recommended, relevant, k=10):
    rec_k = recommended[:k]
    return len(set(rec_k) & set(relevant)) / len(relevant) if relevant else 0

def f1_at_k(recommended, relevant, k=10):
    p = precision_at_k(recommended, relevant, k)
    r = recall_at_k(recommended, relevant, k)
    return 2 * p * r / (p + r) if p + r > 0 else 0

def ndcg_at_k(recommended, relevant, k=10):
    rec_k = recommended[:k]
    dcg = sum([1/np.log2(i+2) for i,item in enumerate(rec_k) if item in relevant])
    ideal_dcg = sum([1/np.log2(i+2) for i in range(min(len(relevant), k))])
    return dcg / ideal_dcg if ideal_dcg > 0 else 0

def accuracy_at_k(recommended, relevant, k=10):
    rec_k = recommended[:k]
    return 1.0 if set(rec_k) & set(relevant) else 0.0
