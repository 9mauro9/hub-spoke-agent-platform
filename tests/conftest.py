"""
Pytest configuration and shared fixtures for Hub-and-Spoke platform.
"""

import os
import pytest

MOCK_REPO = os.path.join(os.path.dirname(__file__), "mock_target_repo")


@pytest.fixture(autouse=True)
def setup_mock_repo():
    os.makedirs(os.path.join(MOCK_REPO, "src", "__pycache__"), exist_ok=True)
    os.makedirs(os.path.join(MOCK_REPO, "docs"), exist_ok=True)
    os.makedirs(os.path.join(MOCK_REPO, "config", "schemas"), exist_ok=True)

    ds_store = os.path.join(MOCK_REPO, ".DS_Store")
    if not os.path.exists(ds_store):
        with open(ds_store, "w") as f:
            f.write("mock-ds-store-clutter")

    test_log = os.path.join(MOCK_REPO, "orphaned_test.log")
    if not os.path.exists(test_log):
        with open(test_log, "w") as f:
            f.write("mock-test-log-clutter")

    cache_file = os.path.join(MOCK_REPO, "src", "__pycache__", "cache.pyc")
    if not os.path.exists(cache_file):
        with open(cache_file, "w") as f:
            f.write("mock-pyc-cache")

    readme = os.path.join(MOCK_REPO, "README.md")
    if not os.path.exists(readme):
        with open(readme, "w") as f:
            f.write("# Mock Readme")

    schema_file = os.path.join(MOCK_REPO, "config", "schemas", "task_request.json")
    if not os.path.exists(schema_file):
        with open(schema_file, "w") as f:
            f.write('{"title": "AgentTaskRequest"}')

    yield
