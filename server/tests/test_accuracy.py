# server/app/tests/test_accuracy_safe.py
import random
import pytest
import numpy as np
from unittest.mock import patch

from app.recommender import final_data, get_recommendations
from .test_metrics import precision_at_k, recall_at_k, f1_at_k, ndcg_at_k, accuracy_at_k

# ---------------------------
# Configuration
# ---------------------------
RANDOM_SEED = 42
TOP_N = 10
BATCH_SIZE = 20  # Number of random songs to test in batch

random.seed(RANDOM_SEED)
np.random.seed(RANDOM_SEED)


# ---------------------------
# Single song accuracy test
# ---------------------------
@pytest.mark.asyncio
async def test_single_song_safe():
    """Test metrics for a single random song without external API calls"""
    idx = random.randint(0, len(final_data) - 1)
    query_song = final_data.iloc[idx]["name"]
    true_cluster = final_data.iloc[idx]["cluster"]
    relevant = final_data.index[final_data["cluster"] == true_cluster].tolist()

    # Mock external API calls
    with patch("app.recommender.fetch_itunes_batch") as mock_itunes, \
         patch("app.recommender.get_youtube_thumbnail_and_url") as mock_yt:

        mock_itunes.return_value = {}
        mock_yt.return_value = (None, None)

        recs = await get_recommendations(query_song, top_n=TOP_N)

    # Map recommendation names to dataframe indices
    recommended = [
        final_data.index[final_data["name"] == r["name"]][0]
        for r in recs if not final_data.index[final_data["name"] == r["name"]].empty
    ]

    print(f"\nSong: {query_song}")
    print("Precision@10:", precision_at_k(recommended, relevant))
    print("Recall@10:", recall_at_k(recommended, relevant))
    print("F1@10:", f1_at_k(recommended, relevant))
    print("nDCG@10:", ndcg_at_k(recommended, relevant))
    print("Accuracy@10:", accuracy_at_k(recommended, relevant))


# ---------------------------
# Batch accuracy test
# ---------------------------
@pytest.mark.asyncio
async def test_batch_accuracy_safe():
    """Test metrics on a batch of random songs without external API calls"""
    sample_size = min(BATCH_SIZE, len(final_data))
    sample_idxs = random.sample(range(len(final_data)), sample_size)

    scores = {"precision": [], "recall": [], "f1": [], "ndcg": [], "accuracy": []}

    with patch("app.recommender.fetch_itunes_batch") as mock_itunes, \
         patch("app.recommender.get_youtube_thumbnail_and_url") as mock_yt:

        mock_itunes.return_value = {}
        mock_yt.return_value = (None, None)

        for idx in sample_idxs:
            query_song = final_data.iloc[idx]["name"]
            true_cluster = final_data.iloc[idx]["cluster"]
            relevant = final_data.index[final_data["cluster"] == true_cluster].tolist()

            recs = await get_recommendations(query_song, top_n=TOP_N)
            if not recs:
                continue

            recommended = [
                final_data.index[final_data["name"] == r["name"]][0]
                for r in recs if not final_data.index[final_data["name"] == r["name"]].empty
            ]

            scores["precision"].append(precision_at_k(recommended, relevant))
            scores["recall"].append(recall_at_k(recommended, relevant))
            scores["f1"].append(f1_at_k(recommended, relevant))
            scores["ndcg"].append(ndcg_at_k(recommended, relevant))
            scores["accuracy"].append(accuracy_at_k(recommended, relevant))

    print("\n==== Batch Metrics ====")
    for metric in scores:
        print(f"Avg {metric}@{TOP_N}:", np.mean(scores[metric]))
